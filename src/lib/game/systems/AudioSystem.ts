import {
	AUDIO_PATHS,
	BREAK_SOUND_PROFILES,
	BULLET_IMPACT_SAMPLE_PATHS,
	BULLET_IMPACT_VOLUMES,
	FART_PITCH_RANGE,
	GAME_SOUND_SETTINGS,
	GUNSHOT_PATHS,
	SWIM_SAMPLE_DURATIONS,
	SWIM_SAMPLE_PATHS,
	type GameSoundCue,
	type SynthesizedBreakMaterial
} from '../config/audio';
import type { BreakMaterial, BulletImpactMaterial, GunWeapon } from '../types';

const CHAIR_BREAK_LABELS = new Set(['STOEL', 'TUINSTOEL', 'BOEKENKAST', 'PICKNICKTAFEL']);

export class AudioSystem {
	private muted = false;
	private context: AudioContext | null = null;
	private gunshotBuffers: Partial<Record<GunWeapon, AudioBuffer>> = {};
	private activeSamples = new Set<HTMLAudioElement>();
	private mediaSources = new Map<HTMLAudioElement, MediaElementAudioSourceNode>();
	private mixInput: GainNode | null = null;
	private mixDryGain: GainNode | null = null;
	private mixMasterGain: GainNode | null = null;
	private sewerEchoDelay: DelayNode | null = null;
	private sewerEchoFilter: BiquadFilterNode | null = null;
	private sewerEchoFeedback: GainNode | null = null;
	private sewerEchoGain: GainNode | null = null;
	private sewerReverb: ConvolverNode | null = null;
	private sewerReverbGain: GainNode | null = null;
	private speechPlaying: HTMLAudioElement | null = null;
	private poopieMonsterVoicePlaying: HTMLAudioElement | null = null;
	private poopieMonsterVoiceQueue: HTMLAudioElement[] = [];
	private swimSoundCooldown = 0;
	private lastSwimSampleIndex = -1;
	private outsideActive = false;
	private outsideGain: GainNode | null = null;
	private outsideSources: AudioScheduledSourceNode[] = [];
	private outsideBirdCooldown = 1.2;
	private sewerActive = false;
	private sewerAmbienceBuffer: AudioBuffer | null = null;
	private sewerAmbienceLoad: Promise<void> | null = null;
	private sewerAmbienceSource: AudioBufferSourceNode | null = null;
	private sewerAmbienceGain: GainNode | null = null;

	private readonly impactSample = this.createSample(AUDIO_PATHS.impact);
	private readonly fartSample = this.createSample(AUDIO_PATHS.fart);
	private readonly pistolSample = this.createSample(GUNSHOT_PATHS.pistol);
	private readonly g36Sample = this.createSample(GUNSHOT_PATHS.g36);
	private readonly weaponChangeSample = this.createSample(AUDIO_PATHS.weaponChange);
	private readonly vaseBreakSample = this.createSample(AUDIO_PATHS.vaseBreak);
	private readonly chairBreakSample = this.createSample(AUDIO_PATHS.chairBreak);
	private readonly bigWaterSplashSample = this.createSample(AUDIO_PATHS.bigWaterSplash);
	private readonly poopieMonsterSpeechSample = this.createSample(AUDIO_PATHS.poopieMonsterSpeech);
	private readonly poopieMonsterEatSample = this.createSample(AUDIO_PATHS.poopieMonsterEat);
	private readonly poopieMonsterFriendSample = this.createSample(AUDIO_PATHS.poopieMonsterFriend);
	private readonly poopieMonsterHitSample = this.createSample(AUDIO_PATHS.poopieMonsterHit);
	private readonly poopieMonsterDeathSample = this.createSample(AUDIO_PATHS.poopieMonsterDeath);
	private readonly poopieMonsterDeathThudSample = this.createSample(
		AUDIO_PATHS.poopieMonsterDeathThud
	);
	private readonly swimSamples = SWIM_SAMPLE_PATHS.map((path) => this.createSample(path));
	private readonly bulletImpactSamples = this.createBulletImpactSamples();

	setMuted(muted: boolean) {
		this.muted = muted;
		for (const sample of this.activeSamples) sample.muted = muted;
		if (!muted && (this.outsideActive || this.sewerActive)) this.ensure();
		this.syncMasterGain(0.1);
		this.syncOutsideAmbienceGain(0.16);
		this.syncSewerAmbienceGain(0.16);
		if (!muted) this.playNextPoopieMonsterVoice();
	}

	ensure() {
		if (this.muted) return;
		this.context ??= new AudioContext();
		this.ensureMixGraph();
		if (this.context.state === 'suspended') void this.context.resume();
		if (this.outsideActive) this.ensureOutsideAmbience();
		if (this.sewerActive) this.ensureSewerAmbience();
	}

	setSewer(active: boolean) {
		if (active === this.sewerActive) return;
		this.sewerActive = active;
		if (active) {
			this.ensure();
		}
		this.syncSewerMix(0.45);
		this.syncSewerAmbienceGain(0.75);
	}

	setOutside(active: boolean) {
		if (active === this.outsideActive) return;
		this.outsideActive = active;
		if (active) {
			this.ensure();
			this.outsideBirdCooldown = Math.min(this.outsideBirdCooldown, 1.35);
		}
		this.syncOutsideAmbienceGain(0.75);
	}

	async preloadGunshotBuffers() {
		try {
			this.context ??= new AudioContext();
			const audio = this.context;
			await Promise.all(
				(Object.entries(GUNSHOT_PATHS) as Array<[GunWeapon, string]>).map(
					async ([weapon, path]) => {
						const response = await fetch(path);
						if (!response.ok) throw new Error(`Could not preload ${path}: ${response.status}`);
						this.gunshotBuffers[weapon] = await audio.decodeAudioData(await response.arrayBuffer());
					}
				)
			);
		} catch (error) {
			console.warn('Gunshot audio warmup failed; falling back to media audio.', error);
		}
	}

	preloadHiddenAreaAudio() {
		if (this.sewerAmbienceBuffer) return Promise.resolve();
		if (this.sewerAmbienceLoad) return this.sewerAmbienceLoad;

		this.context ??= new AudioContext();
		const audio = this.context;
		this.ensureMixGraph();
		for (const sample of [
			this.bigWaterSplashSample,
			this.poopieMonsterSpeechSample,
			this.poopieMonsterEatSample,
			this.poopieMonsterFriendSample,
			this.poopieMonsterHitSample,
			this.poopieMonsterDeathSample,
			this.poopieMonsterDeathThudSample
		]) {
			sample.load();
		}

		this.sewerAmbienceLoad = fetch(AUDIO_PATHS.sewerAmbience)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Could not preload ${AUDIO_PATHS.sewerAmbience}: ${response.status}`);
				}
				return response.arrayBuffer();
			})
			.then((data) => audio.decodeAudioData(data))
			.then((buffer) => {
				if (this.context === audio) this.sewerAmbienceBuffer = buffer;
			})
			.catch((error) => {
				console.warn('Sewer ambience warmup failed; audio will retry on entry.', error);
				this.sewerAmbienceLoad = null;
			});
		return this.sewerAmbienceLoad;
	}

	update(delta: number) {
		this.swimSoundCooldown = Math.max(0, this.swimSoundCooldown - delta);
		if (!this.outsideActive || this.muted || !this.outsideGain) return;
		this.outsideBirdCooldown -= delta;
		if (this.outsideBirdCooldown <= 0) {
			this.playOutsideBird();
			this.outsideBirdCooldown = 2.8 + Math.random() * 5.4;
		}
	}

	reset() {
		this.swimSoundCooldown = 0;
		this.lastSwimSampleIndex = -1;
		this.setOutside(false);
		this.setSewer(false);
		this.outsideBirdCooldown = 1.2;
		this.stopPoopieMonsterSpeech();
		this.stopPoopieMonsterVoiceQueue();
	}

	destroy() {
		for (const sample of this.activeSamples) sample.pause();
		this.activeSamples.clear();
		for (const source of this.mediaSources.values()) source.disconnect();
		this.mediaSources.clear();
		this.speechPlaying = null;
		this.poopieMonsterVoicePlaying = null;
		this.poopieMonsterVoiceQueue = [];
		this.gunshotBuffers = {};
		for (const source of this.outsideSources) {
			try {
				source.stop();
			} catch {
				// The audio context may already have stopped this source.
			}
			source.disconnect();
		}
		this.outsideSources = [];
		this.outsideGain?.disconnect();
		this.outsideGain = null;
		try {
			this.sewerAmbienceSource?.stop();
		} catch {
			// A source can already have ended while the game is being torn down.
		}
		this.sewerAmbienceSource?.disconnect();
		this.sewerAmbienceGain?.disconnect();
		this.sewerAmbienceBuffer = null;
		this.sewerAmbienceLoad = null;
		this.sewerAmbienceSource = null;
		this.sewerAmbienceGain = null;
		this.mixInput?.disconnect();
		this.mixDryGain?.disconnect();
		this.mixMasterGain?.disconnect();
		this.sewerEchoDelay?.disconnect();
		this.sewerEchoFilter?.disconnect();
		this.sewerEchoFeedback?.disconnect();
		this.sewerEchoGain?.disconnect();
		this.sewerReverb?.disconnect();
		this.sewerReverbGain?.disconnect();
		this.mixInput = null;
		this.mixDryGain = null;
		this.mixMasterGain = null;
		this.sewerEchoDelay = null;
		this.sewerEchoFilter = null;
		this.sewerEchoFeedback = null;
		this.sewerEchoGain = null;
		this.sewerReverb = null;
		this.sewerReverbGain = null;
		void this.context?.close();
		this.context = null;
	}

	playFart() {
		this.playSample(this.fartSample, (sample) => {
			sample.volume = 0.82;
			sample.preservesPitch = false;
			sample.playbackRate = lerp(FART_PITCH_RANGE.min, FART_PITCH_RANGE.max, Math.random());
		});
	}

	playPoopieMonsterSpeech() {
		if (this.muted || this.speechPlaying || this.poopieMonsterVoicePlaying) return;
		const sample = this.poopieMonsterSpeechSample.cloneNode(true) as HTMLAudioElement;
		sample.volume = 0.9;
		const cleanup = () => {
			this.activeSamples.delete(sample);
			this.disconnectSampleFromMix(sample);
			if (this.speechPlaying === sample) this.speechPlaying = null;
		};
		sample.addEventListener('ended', cleanup, { once: true });
		this.speechPlaying = sample;
		this.activeSamples.add(sample);
		this.connectSampleToMix(sample);
		void sample.play().catch(cleanup);
	}

	stopPoopieMonsterSpeech() {
		const sample = this.speechPlaying;
		if (!sample) return;
		sample.pause();
		sample.currentTime = 0;
		this.activeSamples.delete(sample);
		this.disconnectSampleFromMix(sample);
		this.speechPlaying = null;
	}

	playPoopieMonsterEat() {
		this.queuePoopieMonsterVoice(this.poopieMonsterEatSample);
	}

	playPoopieMonsterFriend() {
		this.queuePoopieMonsterVoice(this.poopieMonsterFriendSample);
	}

	playPoopieMonsterHit() {
		this.queuePoopieMonsterVoice(this.poopieMonsterHitSample);
	}

	playPoopieMonsterDeath() {
		this.queuePoopieMonsterVoice(this.poopieMonsterDeathSample, true);
	}

	playPoopieMonsterDeathThud() {
		this.playSample(this.poopieMonsterDeathThudSample, (sample) => {
			sample.volume = 1;
		});
		if (this.muted) return;
		this.ensure();
		const audio = this.context;
		if (!audio) return;

		const now = audio.currentTime;
		const duration = 0.72;
		const output = audio.createDynamicsCompressor();
		output.threshold.setValueAtTime(-14, now);
		output.knee.setValueAtTime(8, now);
		output.ratio.setValueAtTime(5, now);
		output.attack.setValueAtTime(0.004, now);
		output.release.setValueAtTime(0.28, now);
		output.connect(this.getAudioOutput(audio));

		const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
		const noise = buffer.getChannelData(0);
		for (let index = 0; index < noise.length; index += 1) {
			const progress = index / noise.length;
			noise[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.4);
		}
		const impact = audio.createBufferSource();
		const impactFilter = audio.createBiquadFilter();
		const impactGain = audio.createGain();
		impact.buffer = buffer;
		impactFilter.type = 'lowpass';
		impactFilter.frequency.setValueAtTime(260, now);
		impactFilter.frequency.exponentialRampToValueAtTime(55, now + duration);
		impactFilter.Q.setValueAtTime(0.8, now);
		impactGain.gain.setValueAtTime(0.08, now);
		impactGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		impact.connect(impactFilter).connect(impactGain).connect(output);
		impact.start(now);

		const sub = audio.createOscillator();
		const subGain = audio.createGain();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(74, now);
		sub.frequency.exponentialRampToValueAtTime(27, now + duration);
		subGain.gain.setValueAtTime(0.16, now);
		subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		sub.connect(subGain).connect(output);
		sub.start(now);
		sub.stop(now + duration);
	}

	playGunshot(weapon: GunWeapon) {
		if (this.muted) return;
		this.ensure();
		const buffer = this.gunshotBuffers[weapon];
		const audio = this.context;
		if (buffer && audio) {
			const source = audio.createBufferSource();
			const gain = audio.createGain();
			source.buffer = buffer;
			gain.gain.value = weapon === 'g36' ? 0.74 : 0.86;
			source.connect(gain).connect(this.getAudioOutput(audio));
			source.addEventListener(
				'ended',
				() => {
					source.disconnect();
					gain.disconnect();
				},
				{ once: true }
			);
			source.start();
			return;
		}
		this.playSample(weapon === 'g36' ? this.g36Sample : this.pistolSample, (sample) => {
			sample.volume = weapon === 'g36' ? 0.74 : 0.86;
		});
	}

	playWeaponChange() {
		this.playSample(this.weaponChangeSample, (sample) => {
			sample.volume = 0.64;
		});
	}

	playBulletImpact(kind: BulletImpactMaterial) {
		const options = this.bulletImpactSamples[kind];
		const source = options[Math.floor(Math.random() * options.length)];
		this.playSample(source, (sample) => {
			sample.volume = BULLET_IMPACT_VOLUMES[kind];
		});
	}

	playImpact(power: number) {
		this.playSample(this.impactSample, (sample) => {
			sample.volume = lerp(0.5, 0.88, power);
			sample.playbackRate = lerp(0.86, 1.04, power);
		});
	}

	playVaseBreak() {
		this.playSample(this.vaseBreakSample, (sample) => {
			sample.volume = 0.82;
			sample.playbackRate = 0.94 + Math.random() * 0.1;
		});
	}

	playChairBreak() {
		this.playSample(this.chairBreakSample, (sample) => {
			sample.volume = 0.72;
			sample.playbackRate = 0.97 + Math.random() * 0.06;
		});
	}

	playBreak(kind: BreakMaterial, label: string) {
		if (this.muted) return;
		if (CHAIR_BREAK_LABELS.has(label)) {
			this.playChairBreak();
			return;
		}
		if (kind === 'ceramic') {
			this.playVaseBreak();
			return;
		}
		this.playSynthesizedBreak(kind);
	}

	playCue(kind: GameSoundCue) {
		if (this.muted) return;
		this.ensure();
		const audio = this.context;
		if (!audio) return;
		const oscillator = audio.createOscillator();
		const gain = audio.createGain();
		const now = audio.currentTime;
		const [from, to, duration, type] = GAME_SOUND_SETTINGS[kind];
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(from, now);
		oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
		gain.gain.setValueAtTime(0.07, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		oscillator.connect(gain).connect(this.getAudioOutput(audio));
		oscillator.start(now);
		oscillator.stop(now + duration);
	}

	playSwimming(submersion: number, movementSpeed: number) {
		if (this.muted || this.swimSoundCooldown > 0 || movementSpeed < 0.65) return;

		let index = Math.floor(Math.random() * this.swimSamples.length);
		if (index === this.lastSwimSampleIndex) {
			index =
				(index + 1 + Math.floor(Math.random() * (this.swimSamples.length - 1))) %
				this.swimSamples.length;
		}
		this.lastSwimSampleIndex = index;
		this.swimSoundCooldown = SWIM_SAMPLE_DURATIONS[index] * (0.78 + Math.random() * 0.16);

		this.playSample(this.swimSamples[index], (sample) => {
			const movementVolume = clamp(0.22 + movementSpeed * 0.045, 0.24, 0.5);
			sample.volume = movementVolume * lerp(0.62, 1, submersion);
		});
	}

	playWaterSplash(impactSpeed: number) {
		if (this.muted) return;
		this.ensure();
		const audio = this.context;
		if (!audio) return;
		const strength = clamp(impactSpeed / 12, 0.3, 1);
		const now = audio.currentTime;
		const duration = 0.13 + strength * 0.13;
		const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
		const noise = buffer.getChannelData(0);
		for (let index = 0; index < noise.length; index += 1) {
			const progress = index / noise.length;
			const envelope = Math.pow(1 - progress, 2.1) * Math.min(1, progress * 18);
			noise[index] = (Math.random() * 2 - 1) * envelope;
		}
		const source = audio.createBufferSource();
		const filter = audio.createBiquadFilter();
		const gain = audio.createGain();
		source.buffer = buffer;
		filter.type = 'bandpass';
		filter.frequency.setValueAtTime(620 + strength * 480, now);
		filter.frequency.exponentialRampToValueAtTime(240, now + duration);
		filter.Q.setValueAtTime(0.7, now);
		gain.gain.setValueAtTime(0.035 + strength * 0.055, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		const output = this.getAudioOutput(audio);
		source.connect(filter).connect(gain).connect(output);
		source.start(now);

		const plop = audio.createOscillator();
		const plopGain = audio.createGain();
		plop.type = 'sine';
		plop.frequency.setValueAtTime(150 + strength * 55, now);
		plop.frequency.exponentialRampToValueAtTime(72, now + duration * 0.8);
		plopGain.gain.setValueAtTime(0.025 + strength * 0.025, now);
		plopGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		plop.connect(plopGain).connect(output);
		plop.start(now);
		plop.stop(now + duration);
	}

	playBigWaterSplash(impactSpeed: number) {
		this.playWaterSplash(impactSpeed);
		this.playSample(this.bigWaterSplashSample, (sample) => {
			const strength = clamp(impactSpeed / 12, 0.45, 1);
			sample.volume = 0.48 + strength * 0.18;
			sample.preservesPitch = false;
			sample.playbackRate = 0.97 + Math.random() * 0.05;
		});
	}

	private ensureOutsideAmbience() {
		const audio = this.context;
		if (!audio || this.outsideGain) return;

		this.outsideGain = audio.createGain();
		this.outsideGain.gain.value = 0;
		this.outsideGain.connect(this.getAudioOutput(audio));

		const duration = 5;
		const noiseBuffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
		const noise = noiseBuffer.getChannelData(0);
		let smoothNoise = 0;
		for (let index = 0; index < noise.length; index += 1) {
			smoothNoise = smoothNoise * 0.72 + (Math.random() * 2 - 1) * 0.28;
			noise[index] = smoothNoise;
		}

		const wind = audio.createBufferSource();
		const windFilter = audio.createBiquadFilter();
		const windGain = audio.createGain();
		wind.buffer = noiseBuffer;
		wind.loop = true;
		windFilter.type = 'bandpass';
		windFilter.frequency.value = 720;
		windFilter.Q.value = 0.42;
		windGain.gain.value = 0.045;
		wind.connect(windFilter).connect(windGain).connect(this.outsideGain);

		const windPulse = audio.createOscillator();
		const windPulseDepth = audio.createGain();
		windPulse.type = 'sine';
		windPulse.frequency.value = 0.085;
		windPulseDepth.gain.value = 0.014;
		windPulse.connect(windPulseDepth).connect(windGain.gain);

		const traffic = audio.createBufferSource();
		const trafficFilter = audio.createBiquadFilter();
		const trafficGain = audio.createGain();
		traffic.buffer = noiseBuffer;
		traffic.loop = true;
		traffic.playbackRate.value = 0.63;
		trafficFilter.type = 'lowpass';
		trafficFilter.frequency.value = 185;
		trafficFilter.Q.value = 0.5;
		trafficGain.gain.value = 0.055;
		traffic.connect(trafficFilter).connect(trafficGain).connect(this.outsideGain);

		wind.start();
		windPulse.start();
		traffic.start(audio.currentTime + 0.17);
		this.outsideSources.push(wind, windPulse, traffic);
		this.syncOutsideAmbienceGain(0.75);
	}

	private syncOutsideAmbienceGain(duration: number) {
		const audio = this.context;
		const gain = this.outsideGain;
		if (!audio || !gain) return;
		const now = audio.currentTime;
		const target = this.outsideActive && !this.muted ? 0.34 : 0;
		gain.gain.cancelScheduledValues(now);
		gain.gain.setValueAtTime(gain.gain.value, now);
		gain.gain.linearRampToValueAtTime(target, now + duration);
	}

	private playOutsideBird() {
		const audio = this.context;
		const output = this.outsideGain;
		if (!audio || !output) return;
		const now = audio.currentTime;
		const baseFrequency = 1800 + Math.random() * 850;
		const chirpCount = Math.random() > 0.62 ? 3 : 2;
		for (let index = 0; index < chirpCount; index += 1) {
			const start = now + index * (0.105 + Math.random() * 0.035);
			const duration = 0.085 + Math.random() * 0.045;
			const oscillator = audio.createOscillator();
			const gain = audio.createGain();
			oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
			oscillator.frequency.setValueAtTime(baseFrequency * (0.96 + index * 0.08), start);
			oscillator.frequency.exponentialRampToValueAtTime(
				baseFrequency * (1.28 + Math.random() * 0.22),
				start + duration * 0.48
			);
			oscillator.frequency.exponentialRampToValueAtTime(
				baseFrequency * (1.02 + Math.random() * 0.08),
				start + duration
			);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.05, start + duration * 0.18);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
			oscillator.connect(gain).connect(output);
			oscillator.start(start);
			oscillator.stop(start + duration);
			oscillator.addEventListener(
				'ended',
				() => {
					oscillator.disconnect();
					gain.disconnect();
				},
				{ once: true }
			);
		}
	}

	private ensureMixGraph() {
		const audio = this.context;
		if (!audio || this.mixInput) return;

		this.mixInput = audio.createGain();
		this.mixDryGain = audio.createGain();
		this.mixMasterGain = audio.createGain();
		this.sewerEchoDelay = audio.createDelay(1);
		this.sewerEchoFilter = audio.createBiquadFilter();
		this.sewerEchoFeedback = audio.createGain();
		this.sewerEchoGain = audio.createGain();
		this.sewerReverb = audio.createConvolver();
		this.sewerReverbGain = audio.createGain();

		this.mixDryGain.gain.value = 1;
		this.mixMasterGain.gain.value = this.muted ? 0 : 1;
		this.sewerEchoDelay.delayTime.value = 0.215;
		this.sewerEchoFilter.type = 'lowpass';
		this.sewerEchoFilter.frequency.value = 1850;
		this.sewerEchoFilter.Q.value = 0.55;
		this.sewerEchoFeedback.gain.value = 0;
		this.sewerEchoGain.gain.value = 0;
		this.sewerReverb.buffer = this.createSewerImpulse(audio);
		this.sewerReverbGain.gain.value = 0;

		this.mixInput.connect(this.mixDryGain).connect(this.mixMasterGain);
		this.mixInput.connect(this.sewerEchoDelay);
		this.sewerEchoDelay.connect(this.sewerEchoFilter);
		this.sewerEchoFilter.connect(this.sewerEchoGain).connect(this.mixMasterGain);
		this.sewerEchoFilter.connect(this.sewerEchoFeedback).connect(this.sewerEchoDelay);
		this.mixInput
			.connect(this.sewerReverb)
			.connect(this.sewerReverbGain)
			.connect(this.mixMasterGain);
		this.mixMasterGain.connect(audio.destination);
		this.syncSewerMix(0);
	}

	private createSewerImpulse(audio: AudioContext) {
		const duration = 1.85;
		const buffer = audio.createBuffer(2, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
		for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
			const data = buffer.getChannelData(channel);
			for (let index = 0; index < data.length; index += 1) {
				const progress = index / data.length;
				const earlyReflection =
					index % Math.max(1, Math.round(audio.sampleRate * 0.037)) < 3 ? 0.24 : 0;
				data[index] =
					((Math.random() * 2 - 1) * 0.78 + earlyReflection) * Math.pow(1 - progress, 2.35);
			}
		}
		return buffer;
	}

	private syncSewerMix(duration: number) {
		const audio = this.context;
		if (
			!audio ||
			!this.mixDryGain ||
			!this.sewerEchoFeedback ||
			!this.sewerEchoGain ||
			!this.sewerReverbGain
		) {
			return;
		}
		const now = audio.currentTime;
		this.rampGain(this.mixDryGain.gain, this.sewerActive ? 0.88 : 1, now, duration);
		this.rampGain(this.sewerEchoFeedback.gain, this.sewerActive ? 0.31 : 0, now, duration);
		this.rampGain(this.sewerEchoGain.gain, this.sewerActive ? 0.3 : 0, now, duration);
		this.rampGain(this.sewerReverbGain.gain, this.sewerActive ? 0.24 : 0, now, duration);
	}

	private ensureSewerAmbience() {
		const audio = this.context;
		if (!audio) return;
		if (!this.sewerAmbienceGain) {
			this.sewerAmbienceGain = audio.createGain();
			this.sewerAmbienceGain.gain.value = 0;
			this.sewerAmbienceGain.connect(this.getAudioOutput(audio));
			this.syncSewerAmbienceGain(0);
		}
		if (this.sewerAmbienceSource) return;
		if (!this.sewerAmbienceBuffer) {
			void this.preloadHiddenAreaAudio().then(() => {
				if (this.sewerActive && this.sewerAmbienceBuffer) this.ensureSewerAmbience();
			});
			return;
		}

		const source = audio.createBufferSource();
		source.buffer = this.sewerAmbienceBuffer;
		source.loop = true;
		source.connect(this.sewerAmbienceGain);
		source.addEventListener(
			'ended',
			() => {
				if (this.sewerAmbienceSource === source) this.sewerAmbienceSource = null;
			},
			{ once: true }
		);
		this.sewerAmbienceSource = source;
		source.start();
	}

	private syncSewerAmbienceGain(duration: number) {
		const audio = this.context;
		const gain = this.sewerAmbienceGain;
		if (!audio || !gain) return;
		const target = this.sewerActive && !this.muted ? 0.5 : 0;
		this.rampGain(gain.gain, target, audio.currentTime, duration);
	}

	private syncMasterGain(duration: number) {
		const audio = this.context;
		const gain = this.mixMasterGain;
		if (!audio || !gain) return;
		this.rampGain(gain.gain, this.muted ? 0 : 1, audio.currentTime, duration);
	}

	private rampGain(parameter: AudioParam, target: number, now: number, duration: number) {
		parameter.cancelScheduledValues(now);
		parameter.setValueAtTime(parameter.value, now);
		if (duration <= 0) parameter.setValueAtTime(target, now);
		else parameter.linearRampToValueAtTime(target, now + duration);
	}

	private getAudioOutput(audio: AudioContext): AudioNode {
		this.ensureMixGraph();
		return this.mixInput ?? audio.destination;
	}

	private connectSampleToMix(sample: HTMLAudioElement) {
		this.ensure();
		const audio = this.context;
		if (!audio || this.mediaSources.has(sample)) return;
		try {
			const source = audio.createMediaElementSource(sample);
			source.connect(this.getAudioOutput(audio));
			this.mediaSources.set(sample, source);
		} catch {
			// If a browser rejects media-element routing, the sample still plays through its native output.
		}
	}

	private disconnectSampleFromMix(sample: HTMLAudioElement) {
		const source = this.mediaSources.get(sample);
		if (!source) return;
		source.disconnect();
		this.mediaSources.delete(sample);
	}

	private createSample(path: string) {
		const sample = new Audio(path);
		sample.preload = 'auto';
		return sample;
	}

	private createBulletImpactSamples() {
		const result = {} as Record<BulletImpactMaterial, HTMLAudioElement[]>;
		for (const [kind, paths] of Object.entries(BULLET_IMPACT_SAMPLE_PATHS) as Array<
			[BulletImpactMaterial, readonly string[]]
		>) {
			result[kind] = paths.map((path) => this.createSample(path));
		}
		return result;
	}

	private playSample(source: HTMLAudioElement, configure: (sample: HTMLAudioElement) => void) {
		if (this.muted) return;
		const sample = source.cloneNode(true) as HTMLAudioElement;
		configure(sample);
		const cleanup = () => {
			this.activeSamples.delete(sample);
			this.disconnectSampleFromMix(sample);
		};
		sample.addEventListener('ended', cleanup, { once: true });
		this.activeSamples.add(sample);
		this.connectSampleToMix(sample);
		void sample.play().catch(cleanup);
	}

	private queuePoopieMonsterVoice(source: HTMLAudioElement, interrupt = false) {
		if (this.muted) return;
		this.stopPoopieMonsterSpeech();
		if (interrupt) this.stopPoopieMonsterVoiceQueue();
		this.poopieMonsterVoiceQueue.push(source);
		this.playNextPoopieMonsterVoice();
	}

	private playNextPoopieMonsterVoice() {
		if (this.muted || this.poopieMonsterVoicePlaying) return;
		const source = this.poopieMonsterVoiceQueue.shift();
		if (!source) return;

		const sample = source.cloneNode(true) as HTMLAudioElement;
		sample.volume = 0.9;
		const cleanup = () => {
			this.activeSamples.delete(sample);
			this.disconnectSampleFromMix(sample);
			if (this.poopieMonsterVoicePlaying === sample) this.poopieMonsterVoicePlaying = null;
			this.playNextPoopieMonsterVoice();
		};
		sample.addEventListener('ended', cleanup, { once: true });
		this.poopieMonsterVoicePlaying = sample;
		this.activeSamples.add(sample);
		this.connectSampleToMix(sample);
		void sample.play().catch(cleanup);
	}

	private stopPoopieMonsterVoiceQueue() {
		this.poopieMonsterVoiceQueue = [];
		const sample = this.poopieMonsterVoicePlaying;
		if (!sample) return;
		sample.pause();
		sample.currentTime = 0;
		this.activeSamples.delete(sample);
		this.disconnectSampleFromMix(sample);
		this.poopieMonsterVoicePlaying = null;
	}

	private playSynthesizedBreak(kind: SynthesizedBreakMaterial) {
		this.ensure();
		const audio = this.context;
		if (!audio) return;
		const profile = BREAK_SOUND_PROFILES[kind];
		const now = audio.currentTime;
		const buffer = audio.createBuffer(
			1,
			Math.ceil(audio.sampleRate * profile.duration),
			audio.sampleRate
		);
		const noise = buffer.getChannelData(0);
		for (let index = 0; index < noise.length; index += 1) {
			const envelope = Math.pow(1 - index / noise.length, 1.2);
			noise[index] = (Math.random() * 2 - 1) * envelope;
		}
		const source = audio.createBufferSource();
		const filter = audio.createBiquadFilter();
		const noiseGain = audio.createGain();
		source.buffer = buffer;
		filter.type = profile.filterType;
		filter.frequency.setValueAtTime(profile.filter, now);
		filter.Q.setValueAtTime(1.4, now);
		noiseGain.gain.setValueAtTime(profile.gain, now);
		noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
		const output = this.getAudioOutput(audio);
		source.connect(filter).connect(noiseGain).connect(output);
		source.start(now);

		profile.tones.forEach((frequency, index) => {
			const oscillator = audio.createOscillator();
			const toneGain = audio.createGain();
			const start = now + index * 0.008;
			oscillator.type = profile.wave;
			oscillator.frequency.setValueAtTime(frequency, start);
			oscillator.frequency.exponentialRampToValueAtTime(
				Math.max(55, frequency * (kind === 'metal' ? 0.92 : 0.42)),
				start + profile.duration
			);
			toneGain.gain.setValueAtTime(profile.gain / Math.max(2, profile.tones.length), start);
			toneGain.gain.exponentialRampToValueAtTime(0.0001, start + profile.duration);
			oscillator.connect(toneGain).connect(output);
			oscillator.start(start);
			oscillator.stop(start + profile.duration);
		});
	}
}

function lerp(from: number, to: number, amount: number) {
	return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, value));
}
