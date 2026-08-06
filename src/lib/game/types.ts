export type GamePhase = 'idle' | 'playing' | 'finished';

export type WeaponName = 'poop' | 'pistol' | 'g36';

export type RabbitStyle = 'classic' | 'agent' | 'field' | 'disguise';

export type GunWeapon = Exclude<WeaponName, 'poop'>;

export type BreakMaterial = 'ceramic' | 'wood' | 'metal' | 'plant' | 'electronics' | 'canvas';

export type BulletImpactMaterial =
	| 'land'
	| 'metal'
	| 'water'
	| 'wood'
	| 'body'
	| 'concrete'
	| 'glass'
	| 'grass';

export interface StampHudState {
	phase: GamePhase;
	paused: boolean;
	score: number;
	destroyed: number;
	total: number;
	lastHit: string;
	lastValue: number;
	weapon: WeaponName;
	weaponReady: boolean;
	rabbitStyle: RabbitStyle;
	canCustomize: boolean;
}

export interface GameCallbacks {
	onHud: (state: StampHudState) => void;
	onImpact: (label: string, value: number) => void;
	onFeedback: (message: string) => void;
	onSewerIntro: (active: boolean) => void;
	onReady: () => void;
	onError: (message: string) => void;
}
