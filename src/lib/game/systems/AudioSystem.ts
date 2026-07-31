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
	private speechPlaying: HTMLAudioElement | null = null;
	private poopieMonsterVoicePlaying: HTMLAudioElement | null = null;
	private poopieMonsterVoiceQueue: HTMLAudioElement[] = [];
	private swimSoundCooldown = 0;
	private lastSwimSampleIndex = -1;

	private readonly impactSample = this.createSample(AUDIO_PATHS.impact);
	private readonly fartSample = this.createSample(AUDIO_PATHS.fart);
	private readonly pistolSample = this.createSample(GUNSHOT_PATHS.pistol);
	private readonly g36Sample = this.createSample(GUNSHOT_PATHS.g36);
	private readonly weaponChangeSample = this.createSample(AUDIO_PATHS.weaponChange);
	private readonly vaseBreakSample = this.createSample(AUDIO_PATHS.vaseBreak);
	private readonly chairBreakSample = this.createSample(AUDIO_PATHS.chairBreak);
	private readonly poopieMonsterSpeechSample = this.createSample(AUDIO_PATHS.poopieMonsterSpeech);
	private readonly poopieMonsterEatSample = this.createSample(AUDIO_PATHS.poopieMonsterEat);
	private readonly poopieMonsterFriendSample = this.createSample(AUDIO_PATHS.poopieMonsterFriend);
	private readonly poopieMonsterDeathSample = this.createSample(AUDIO_PATHS.poopieMonsterDeath);
	private readonly poopieMonsterDeathThudSample = this.createSample(
		AUDIO_PATHS.poopieMonsterDeathThud
	);
	private readonly swimSamples = SWIM_SAMPLE_PATHS.map((path) => this.createSample(path));
	private readonly bulletImpactSamples = this.createBulletImpactSamples();

	setMuted(muted: boolean) {
		this.muted = muted;
		for (const sample of this.activeSamples) sample.muted = muted;
		if (!muted) this.playNextPoopieMonsterVoice();
	}

	ensure() {
		if (this.muted) return;
		this.context ??= new AudioContext();
		if (this.context.state === 'suspended') void this.context.resume();
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

	update(delta: number) {
		this.swimSoundCooldown = Math.max(0, this.swimSoundCooldown - delta);
	}

	reset() {
		this.swimSoundCooldown = 0;
		this.lastSwimSampleIndex = -1;
		this.stopPoopieMonsterSpeech();
		this.stopPoopieMonsterVoiceQueue();
	}

	destroy() {
		for (const sample of this.activeSamples) sample.pause();
		this.activeSamples.clear();
		this.speechPlaying = null;
		this.poopieMonsterVoicePlaying = null;
		this.poopieMonsterVoiceQueue = [];
		this.gunshotBuffers = {};
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
			if (this.speechPlaying === sample) this.speechPlaying = null;
		};
		sample.addEventListener('ended', cleanup, { once: true });
		this.speechPlaying = sample;
		this.activeSamples.add(sample);
		void sample.play().catch(cleanup);
	}

	stopPoopieMonsterSpeech() {
		const sample = this.speechPlaying;
		if (!sample) return;
		sample.pause();
		sample.currentTime = 0;
		this.activeSamples.delete(sample);
		this.speechPlaying = null;
	}

	playPoopieMonsterEat() {
		this.queuePoopieMonsterVoice(this.poopieMonsterEatSample);
	}

	playPoopieMonsterFriend() {
		this.queuePoopieMonsterVoice(this.poopieMonsterFriendSample);
	}

	playPoopieMonsterDeath() {
		this.queuePoopieMonsterVoice(this.poopieMonsterDeathSample, true);
	}

	playPoopieMonsterFinalHit() {
		const options = this.bulletImpactSamples.body;
		const source = options[Math.floor(Math.random() * options.length)];
		this.playSample(source, (sample) => {
			sample.volume = 0.94;
			sample.preservesPitch = false;
			sample.playbackRate = 0.48;
		});
		if (this.muted) return;
		this.ensure();
		const audio = this.context;
		if (!audio) return;

		const now = audio.currentTime;
		const duration = 0.68;
		const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
		const noise = buffer.getChannelData(0);
		for (let index = 0; index < noise.length; index += 1) {
			const progress = index / noise.length;
			const attack = Math.min(1, progress * 24);
			const pulse = 0.68 + Math.sin(progress * Math.PI * 9) * 0.22;
			noise[index] = (Math.random() * 2 - 1) * attack * Math.pow(1 - progress, 1.35) * pulse;
		}
		const squish = audio.createBufferSource();
		const wetFilter = audio.createBiquadFilter();
		const squishGain = audio.createGain();
		squish.buffer = buffer;
		wetFilter.type = 'lowpass';
		wetFilter.frequency.setValueAtTime(720, now);
		wetFilter.frequency.exponentialRampToValueAtTime(95, now + duration);
		wetFilter.Q.setValueAtTime(1.15, now);
		squishGain.gain.setValueAtTime(0.18, now);
		squishGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		squish.connect(wetFilter).connect(squishGain).connect(audio.destination);
		squish.start(now);

		const body = audio.createOscillator();
		const bodyGain = audio.createGain();
		body.type = 'sine';
		body.frequency.setValueAtTime(118, now);
		body.frequency.exponentialRampToValueAtTime(39, now + duration * 0.88);
		bodyGain.gain.setValueAtTime(0.13, now);
		bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		body.connect(bodyGain).connect(audio.destination);
		body.start(now);
		body.stop(now + duration);
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
		output.connect(audio.destination);

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
		const buffer = this.gunshotBuffers[weapon];
		const audio = this.context;
		if (buffer && audio) {
			const source = audio.createBufferSource();
			const gain = audio.createGain();
			source.buffer = buffer;
			gain.gain.value = weapon === 'g36' ? 0.74 : 0.86;
			source.connect(gain).connect(audio.destination);
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
		oscillator.connect(gain).connect(audio.destination);
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
		source.connect(filter).connect(gain).connect(audio.destination);
		source.start(now);

		const plop = audio.createOscillator();
		const plopGain = audio.createGain();
		plop.type = 'sine';
		plop.frequency.setValueAtTime(150 + strength * 55, now);
		plop.frequency.exponentialRampToValueAtTime(72, now + duration * 0.8);
		plopGain.gain.setValueAtTime(0.025 + strength * 0.025, now);
		plopGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		plop.connect(plopGain).connect(audio.destination);
		plop.start(now);
		plop.stop(now + duration);
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
		const cleanup = () => this.activeSamples.delete(sample);
		sample.addEventListener('ended', cleanup, { once: true });
		this.activeSamples.add(sample);
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
			if (this.poopieMonsterVoicePlaying === sample) this.poopieMonsterVoicePlaying = null;
			this.playNextPoopieMonsterVoice();
		};
		sample.addEventListener('ended', cleanup, { once: true });
		this.poopieMonsterVoicePlaying = sample;
		this.activeSamples.add(sample);
		void sample.play().catch(cleanup);
	}

	private stopPoopieMonsterVoiceQueue() {
		this.poopieMonsterVoiceQueue = [];
		const sample = this.poopieMonsterVoicePlaying;
		if (!sample) return;
		sample.pause();
		sample.currentTime = 0;
		this.activeSamples.delete(sample);
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
		source.connect(filter).connect(noiseGain).connect(audio.destination);
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
			oscillator.connect(toneGain).connect(audio.destination);
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
