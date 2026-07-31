import type { BreakMaterial, BulletImpactMaterial, GunWeapon } from '../types';

export const AUDIO_PATHS = {
	impact: '/audio/bounce.ogg',
	fart: '/audio/weapons/fart.ogg',
	weaponChange: '/audio/weapons/change.ogg',
	vaseBreak: '/audio/vase-break.ogg',
	chairBreak: '/audio/chair-break.ogg',
	poopieMonsterSpeech: '/audio/characters/poopiemonster.ogg'
} as const;

export const GUNSHOT_PATHS: Record<GunWeapon, string> = {
	pistol: '/audio/weapons/pistol.ogg',
	g36: '/audio/weapons/g36.ogg'
};

export const SWIM_SAMPLE_PATHS = [
	'/audio/pool/swim-1.ogg',
	'/audio/pool/swim-2.ogg',
	'/audio/pool/swim-3.ogg',
	'/audio/pool/swim-4.ogg'
] as const;

export const SWIM_SAMPLE_DURATIONS = [0.97, 1.32, 1.96, 0.93] as const;

export const FART_PITCH_RANGE = { min: 0.5, max: 1.5 } as const;

export const BULLET_IMPACT_SAMPLE_PATHS: Record<BulletImpactMaterial, readonly string[]> = {
	land: ['/audio/impacts/land-1.ogg', '/audio/impacts/land-2.ogg', '/audio/impacts/land-3.ogg'],
	metal: ['/audio/impacts/metal-1.ogg', '/audio/impacts/metal-2.ogg', '/audio/impacts/metal-3.ogg'],
	water: ['/audio/impacts/water-1.ogg', '/audio/impacts/water-2.ogg', '/audio/impacts/water-3.ogg'],
	wood: ['/audio/impacts/wood-1.ogg', '/audio/impacts/wood-2.ogg', '/audio/impacts/wood-3.ogg'],
	body: ['/audio/impacts/body-1.ogg', '/audio/impacts/body-2.ogg', '/audio/impacts/body-3.ogg'],
	concrete: [
		'/audio/impacts/concrete-1.ogg',
		'/audio/impacts/concrete-2.ogg',
		'/audio/impacts/concrete-3.ogg'
	],
	glass: ['/audio/impacts/glass-1.ogg', '/audio/impacts/glass-2.ogg', '/audio/impacts/glass-3.ogg'],
	grass: ['/audio/impacts/grass-1.ogg', '/audio/impacts/grass-2.ogg', '/audio/impacts/grass-3.ogg']
};

export const BULLET_IMPACT_VOLUMES: Record<BulletImpactMaterial, number> = {
	land: 0.48,
	metal: 0.5,
	water: 0.58,
	wood: 0.52,
	body: 0.56,
	concrete: 0.5,
	glass: 0.54,
	grass: 0.48
};

export type SynthesizedBreakMaterial = Exclude<BreakMaterial, 'ceramic'>;

interface BreakSoundProfile {
	duration: number;
	filter: number;
	gain: number;
	tones: readonly number[];
	wave: OscillatorType;
	filterType: BiquadFilterType;
}

export const BREAK_SOUND_PROFILES: Record<SynthesizedBreakMaterial, BreakSoundProfile> = {
	wood: {
		duration: 0.3,
		filter: 720,
		gain: 0.15,
		tones: [105, 168],
		wave: 'triangle',
		filterType: 'lowpass'
	},
	metal: {
		duration: 0.7,
		filter: 2100,
		gain: 0.13,
		tones: [410, 735, 1260],
		wave: 'triangle',
		filterType: 'bandpass'
	},
	plant: {
		duration: 0.25,
		filter: 1250,
		gain: 0.1,
		tones: [92],
		wave: 'sine',
		filterType: 'lowpass'
	},
	electronics: {
		duration: 0.42,
		filter: 2600,
		gain: 0.14,
		tones: [920, 460, 118],
		wave: 'square',
		filterType: 'bandpass'
	},
	canvas: {
		duration: 0.34,
		filter: 880,
		gain: 0.11,
		tones: [135],
		wave: 'sawtooth',
		filterType: 'lowpass'
	}
};

export type GameSoundCue = 'start' | 'bounce' | 'wall' | 'finish';

export const GAME_SOUND_SETTINGS: Record<
	GameSoundCue,
	readonly [from: number, to: number, duration: number, type: OscillatorType]
> = {
	start: [260, 520, 0.12, 'sine'],
	bounce: [170, 300, 0.1, 'sine'],
	wall: [115, 78, 0.08, 'triangle'],
	finish: [180, 600, 0.4, 'sine']
};
