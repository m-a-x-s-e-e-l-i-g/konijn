import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type GamePhase = 'idle' | 'playing' | 'finished';
export type WeaponName = 'poop' | 'pistol';
type BreakMaterial = 'ceramic' | 'wood' | 'metal' | 'plant' | 'electronics' | 'canvas';
type StampSurfaceKind = 'floor' | 'wall';
type LeftRoomName = 'bathroom' | 'stairs' | 'bedroom';
type BiomeName = 'ground' | 'basement' | 'sewer';

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
}

interface GameCallbacks {
	onHud: (state: StampHudState) => void;
	onImpact: (label: string, value: number) => void;
	onFeedback: (message: string) => void;
	onReady: () => void;
	onError: (message: string) => void;
}

interface Breakable {
	group: THREE.Group;
	label: string;
	value: number;
	radius: number;
	height: number;
	color: THREE.Color;
	material: BreakMaterial;
	broken: boolean;
	stampCount: number;
	stampsRequired: number;
	lastStampSequence: number;
	basePosition: THREE.Vector3;
	baseQuaternion: THREE.Quaternion;
	tiltAxis: THREE.Vector3;
	biome: BiomeName;
}

interface DebrisPiece {
	mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
	velocity: THREE.Vector3;
	spin: THREE.Vector3;
	life: number;
}

interface ImpactRing {
	mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
	life: number;
}

interface SurfaceCrack {
	mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
	texture: THREE.CanvasTexture;
}

interface WeaponProjectile {
	mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>;
	velocity: THREE.Vector3;
	life: number;
	kind: WeaponName;
	spawnDelay: number;
}

interface SewerObstacle {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

interface MuzzleEffect {
	mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | THREE.Sprite;
	velocity: THREE.Vector3;
	life: number;
	maxLife: number;
	growth: number;
	opacity: number;
	delay: number;
	followMuzzleUntilVisible: boolean;
}

interface MuzzleLightEffect {
	light: THREE.PointLight;
	life: number;
	maxLife: number;
	intensity: number;
}

interface ArmRagdoll {
	object: THREE.Object3D;
	baseQuaternion: THREE.Quaternion;
	direction: -1 | 1;
	angle: number;
	angularVelocity: number;
}

interface LeftRoomDoor {
	room: LeftRoomName;
	label: string;
	centerZ: number;
	width: number;
	height: number;
	pivot: THREE.Group;
	leafRoot: THREE.Group;
	damage: THREE.Group;
	surfaces: THREE.Object3D[];
	open: boolean;
	openAmount: number;
}

const ROOM_WIDTH = 14;
const ROOM_DEPTH = 10;
const ROOM_HEIGHT = 4.8;
const BACK_WALL_Z = -ROOM_DEPTH / 2;
const WINDOW_CENTER_X = -4.7;
const WINDOW_CENTER_Y = 2.9;
const WINDOW_WIDTH = 2.8;
const WINDOW_HEIGHT = 2.1;
const WINDOW_OPENING_WIDTH = 2.54;
const WINDOW_OPENING_HEIGHT = 1.84;
const WINDOW_STAMPS_REQUIRED = 2;
const GOOD_WINDOW_STAMP_SPEED = 8;
const KITCHEN_WIDTH = 7;
const KITCHEN_MIN_X = ROOM_WIDTH / 2;
const KITCHEN_MAX_X = KITCHEN_MIN_X + KITCHEN_WIDTH;
const KITCHEN_CENTER_X = (KITCHEN_MIN_X + KITCHEN_MAX_X) / 2;
const DOOR_CENTER_Z = 1.15;
const DOOR_WIDTH = 2.25;
const DOOR_HEIGHT = 2.85;
const GOOD_DOOR_STAMP_SPEED = 6.5;
const LEFT_ROOMS_WIDTH = 6.5;
const LEFT_ROOMS_MIN_X = -ROOM_WIDTH / 2 - LEFT_ROOMS_WIDTH;
const LEFT_ROOMS_MAX_X = -ROOM_WIDTH / 2;
const LEFT_ROOMS_CENTER_X = (LEFT_ROOMS_MIN_X + LEFT_ROOMS_MAX_X) / 2;
const LEFT_ROOM_DOOR_WIDTH = 1.9;
const LEFT_ROOM_DOOR_HEIGHT = 2.65;
const BATHROOM_MAX_Z = -1.65;
const BEDROOM_MIN_Z = 1.65;
const BATHROOM_DOOR_Z = (BACK_WALL_Z + BATHROOM_MAX_Z) / 2;
const STAIRS_DOOR_Z = 0;
const BEDROOM_DOOR_Z = (BEDROOM_MIN_Z + ROOM_DEPTH / 2) / 2;
const TOILET_X = -12.4;
const TOILET_Z = -4.05;
const TOILET_POOPS_REQUIRED = 16;
const TOILET_CATCH_RADIUS = 0.46;
const TOILET_HOLE_RADIUS = 0.78;
const KITCHEN_HATCH_X = 12.65;
const KITCHEN_HATCH_Z = 3.35;
const KITCHEN_HATCH_WIDTH = 1.65;
const KITCHEN_HATCH_DEPTH = 1.25;
const KITCHEN_BACK_DOOR_X = 12.35;
const KITCHEN_BACK_DOOR_WIDTH = 1.65;
const KITCHEN_BACK_DOOR_HEIGHT = 2.72;
const BASEMENT_FLOOR_Y = -4.2;
const BASEMENT_STAIR_STEP_COUNT = 9;
const BASEMENT_STAIR_RISE = Math.abs(BASEMENT_FLOOR_Y) / (BASEMENT_STAIR_STEP_COUNT + 1);
const BASEMENT_STAIR_RUN = 0.46;
const BASEMENT_STAIR_WIDTH = 1.2;
const BASEMENT_STAIR_BOTTOM_X =
	KITCHEN_HATCH_X - (BASEMENT_STAIR_STEP_COUNT - 1) * BASEMENT_STAIR_RUN;
const BASEMENT_MIN_X = -ROOM_WIDTH / 2;
const BASEMENT_MAX_X = KITCHEN_MAX_X;
const BASEMENT_CENTER_X = (BASEMENT_MIN_X + BASEMENT_MAX_X) / 2;
const SEWER_FLOOR_Y = -8.4;
const SEWER_DEPTH = 2.6;
const SEWER_CENTER_Z = TOILET_Z;
const SEWER_MIN_X = TOILET_X - 3.4;
const SEWER_MAX_X = 68;
const SEWER_WIDTH = SEWER_MAX_X - SEWER_MIN_X;
const SEWER_CENTER_X = (SEWER_MIN_X + SEWER_MAX_X) / 2;
const SEWER_MIN_Z = SEWER_CENTER_Z - SEWER_DEPTH / 2;
const SEWER_MAX_Z = SEWER_CENTER_Z + SEWER_DEPTH / 2;
const SEWER_HEIGHT = 4.25;
const SEWER_CEILING_Y = SEWER_FLOOR_Y + SEWER_HEIGHT;
const SEWER_SHAFT_HALF_WIDTH = TOILET_HOLE_RADIUS - 0.06;
const STAIR_STEP_RISE = 0.48;
const STAIR_STEP_RUN = 0.72;
const STAIR_DOOR_REST_ANGLE = Math.atan(STAIR_STEP_RUN / STAIR_STEP_RISE);
const STAIR_DOOR_REST_LIFT = 0.12;
const STAIR_STRAIGHT_STEP_COUNT = 8;
const STAIR_TURN_STEP_COUNT = 2;
const STAIR_TOP_X = -12.24;
const STAIR_TURN_STEP_ONE_Z = -0.2;
const STAIR_TURN_STEP_TWO_Z = -0.7;
const UPSTAIRS_FLOOR_Y = ROOM_HEIGHT;
const UPSTAIRS_MIN_X = LEFT_ROOMS_MIN_X;
const UPSTAIRS_MAX_X = KITCHEN_MAX_X;
const UPSTAIRS_CENTER_X = (UPSTAIRS_MIN_X + UPSTAIRS_MAX_X) / 2;
const UPSTAIRS_STAIRWELL_X = -12.25;
const UPSTAIRS_LIGHT_INTENSITIES = [13, 9, 7];
const GARDEN_WIDTH = 28;
const GARDEN_DEPTH = 18;
const GARDEN_BACK_Z = BACK_WALL_Z - GARDEN_DEPTH;
const WORLD_MIN_X = Math.min(-GARDEN_WIDTH / 2, LEFT_ROOMS_MIN_X, SEWER_MIN_X);
const WORLD_MAX_X = Math.max(KITCHEN_MAX_X, SEWER_MAX_X);
const PLAYER_RADIUS = 0.52;
const PLAYER_HEIGHT = 1.38;
const FART_PITCH_MIN = 0.5;
const FART_PITCH_MAX = 1.5;
const POOP_BOOST_IMPULSE = 4.2;
const POOP_BOOST_MAX_SPEED = 22;
const BULLET_HALF_LENGTH = 0.06;
const BULLET_SPEED = 26;
const BULLET_LIFETIME = 0.62;
const PISTOL_SPAWN_DELAY = 0.018;
const ARM_AXIS = new THREE.Vector3(0, 0, 1);
const ARM_MIN_ANGLE = -0.22;
const ARM_MAX_ANGLE = 2.2;
const ARM_GRAVITY = 14;
const ARM_DAMPING = 0.9;
const CAMERA_HOME = new THREE.Vector3(0, 6.4, 11.4);
const CAMERA_TARGET = new THREE.Vector3(0, 1.55, 0);
const WEAPON_COOLDOWNS: Record<WeaponName, number> = {
	poop: 0.2,
	pistol: 0.25
};

const COLORS = {
	wall: 0xd7decf,
	wallWarm: 0xeadfcf,
	floor: 0xb7815d,
	rug: 0xe15b3d,
	ink: 0x251f1b,
	cream: 0xf6eddc,
	orange: 0xef7f31,
	green: 0x6e8b62,
	blue: 0x5c7f9b,
	pink: 0xc77478,
	yellow: 0xf0bd42
};

function material(color: number, roughness = 0.82, metalness = 0.02) {
	return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadowMesh(
	geometry: THREE.BufferGeometry,
	meshMaterial: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
) {
	const mesh = new THREE.Mesh(geometry, meshMaterial);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

function box(
	size: [number, number, number],
	position: [number, number, number],
	color: number,
	rotationY = 0
) {
	const mesh = shadowMesh(new THREE.BoxGeometry(...size), material(color));
	mesh.position.set(...position);
	mesh.rotation.y = rotationY;
	return mesh;
}

function cylinder(
	radiusTop: number,
	radiusBottom: number,
	height: number,
	position: [number, number, number],
	color: number,
	segments = 20
) {
	const mesh = shadowMesh(
		new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
		material(color)
	);
	mesh.position.set(...position);
	return mesh;
}

function disposeObject(object: THREE.Object3D) {
	object.traverse((child) => {
		if (!(child instanceof THREE.Mesh)) return;
		child.geometry.dispose();
		const meshMaterial = child.material;
		if (Array.isArray(meshMaterial)) meshMaterial.forEach((item) => item.dispose());
		else meshMaterial.dispose();
	});
}

export class StampKonijnGame {
	private canvas: HTMLCanvasElement;
	private callbacks: GameCallbacks;
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
	private renderer: THREE.WebGLRenderer;
	private timer = new THREE.Timer();
	private loader = new GLTFLoader();
	private player = new THREE.Group();
	private rabbitTumble = new THREE.Group();
	private rabbitSquash = new THREE.Group();
	private armRagdolls: ArmRagdoll[] = [];
	private armRotation = new THREE.Quaternion();
	private pistolPivot: THREE.Group | null = null;
	private pistolMuzzle: THREE.Object3D | null = null;
	private pistolMuzzleWorldPosition = new THREE.Vector3();
	private cameraDesiredPosition = CAMERA_HOME.clone();
	private cameraDesiredTarget = CAMERA_TARGET.clone();
	private cameraLookTarget = CAMERA_TARGET.clone();
	private velocity = new THREE.Vector3();
	private pointerRaycaster = new THREE.Raycaster();
	private projectileRaycaster = new THREE.Raycaster();
	private projectileStep = new THREE.Vector3();
	private pointerNdc = new THREE.Vector2();
	private pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
	private pointerWorldPoint = new THREE.Vector3();
	private pointerDirection = new THREE.Vector3();
	private pointerActive = false;
	private stampSurfaceKinds = new Map<THREE.Object3D, StampSurfaceKind>();
	private bulletImpactSurfaces: THREE.Object3D[] = [];
	private stampDirection = new THREE.Vector3(0, -1, 0);
	private stampTargetNormal = new THREE.Vector3(0, 1, 0);
	private stampTargetKind: StampSurfaceKind = 'floor';
	private stampTargetsWindow = false;
	private stampTargetsDoor = false;
	private stampTargetLeftDoor: LeftRoomDoor | null = null;
	private stampPose = new THREE.Quaternion();
	private breakableTilt = new THREE.Quaternion();
	private uprightPose = new THREE.Quaternion();
	private stampSequence = 0;
	private pendingStampFeedback = '';
	private stomping = false;
	private stompWindup = 0;
	private stompTimeout = 0;
	private breakables: Breakable[] = [];
	private breakablesRoot = new THREE.Group();
	private basementRoot = new THREE.Group();
	private sewerRoot = new THREE.Group();
	private activeBiome: BiomeName = 'ground';
	private groundHemisphere: THREE.HemisphereLight | null = null;
	private groundSun: THREE.DirectionalLight | null = null;
	private groundWindowGlow: THREE.PointLight | null = null;
	private windowBreakaway = new THREE.Group();
	private windowStampSurfaces: THREE.Object3D[] = [];
	private windowHits = 0;
	private windowBroken = false;
	private doorPivot = new THREE.Group();
	private doorLeafRoot = new THREE.Group();
	private doorDamage = new THREE.Group();
	private doorStampSurfaces: THREE.Object3D[] = [];
	private lockedBackDoorLeafRoot = new THREE.Group();
	private lockedBackDoorHit = 0;
	private doorOpen = false;
	private doorOpenAmount = 0;
	private kitchenRevealMask = new THREE.Group();
	private leftRoomRevealMasks = new Map<LeftRoomName, THREE.Group>();
	private playerOutside = false;
	private playerInKitchen = false;
	private playerLeftRoom: LeftRoomName | null = null;
	private leftRoomDoors: LeftRoomDoor[] = [];
	private toiletBreakable: Breakable | null = null;
	private toiletFillRoot = new THREE.Group();
	private toiletPoopCount = 0;
	private toiletSinking = false;
	private toiletSinkAmount = 0;
	private toiletHoleOpen = false;
	private playerInBasement = false;
	private playerInSewer = false;
	private playerUpstairs = false;
	private upstairsRoot = new THREE.Group();
	private upstairsBreakables: Breakable[] = [];
	private toiletHole = new THREE.Group();
	private kitchenHatchBreakable: Breakable | null = null;
	private kitchenHatchDamage = new THREE.Group();
	private kitchenHatchOpen = false;
	private kitchenHatchHole = new THREE.Group();
	private basementEntryCooldown = 0;
	private basementLights: THREE.PointLight[] = [];
	private upstairsLights: THREE.PointLight[] = [];
	private sewerLight = new THREE.PointLight(0xb7cb74, 0, 40, 2);
	private sewerObstacles: SewerObstacle[] = [];
	private debris: DebrisPiece[] = [];
	private impactRings: ImpactRing[] = [];
	private surfaceCracks: SurfaceCrack[] = [];
	private weaponProjectiles: WeaponProjectile[] = [];
	private muzzleEffects: MuzzleEffect[] = [];
	private muzzleLightEffects: MuzzleLightEffect[] = [];
	private muzzleGlowTexture: THREE.CanvasTexture | null = null;
	private muzzleSmokeTexture: THREE.CanvasTexture | null = null;
	private bulletHoles: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
	private resizeObserver: ResizeObserver | null = null;
	private frame = 0;
	private phase: GamePhase = 'idle';
	private paused = false;
	private muted = false;
	private reducedMotion = false;
	private weapon: WeaponName = 'poop';
	private weaponCooldown = 0;
	private weaponHeld = false;
	private score = 0;
	private destroyedCount = 0;
	private lastHit = '';
	private lastValue = 0;
	private lastHudSignature = '';
	private squash = 0;
	private cameraShake = 0;
	private audioContext: AudioContext | null = null;
	private impactSample: HTMLAudioElement;
	private fartSample: HTMLAudioElement;
	private pistolSample: HTMLAudioElement;
	private vaseBreakSample: HTMLAudioElement;
	private chairBreakSample: HTMLAudioElement;
	private activeSamples = new Set<HTMLAudioElement>();
	private keyDownHandler: (event: KeyboardEvent) => void;
	private keyUpHandler: (event: KeyboardEvent) => void;
	private blurHandler: () => void;

	constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
		this.canvas = canvas;
		this.callbacks = callbacks;
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: 'high-performance'
		});
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.05;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.impactSample = new Audio('/audio/bounce.ogg');
		this.impactSample.preload = 'auto';
		this.fartSample = new Audio('/audio/weapons/fart.ogg');
		this.fartSample.preload = 'auto';
		this.pistolSample = new Audio('/audio/weapons/pistol.ogg');
		this.pistolSample.preload = 'auto';
		this.vaseBreakSample = new Audio('/audio/vase-break.ogg');
		this.vaseBreakSample.preload = 'auto';
		this.chairBreakSample = new Audio('/audio/chair-break.ogg');
		this.chairBreakSample.preload = 'auto';

		this.keyDownHandler = (event) => this.handleKey(event, true);
		this.keyUpHandler = (event) => this.handleKey(event, false);
		this.blurHandler = () => {
			this.weaponHeld = false;
			this.pointerActive = false;
		};
	}

	async init() {
		try {
			this.scene.background = new THREE.Color(0xc9d8d1);
			this.scene.fog = new THREE.Fog(0xc9d8d1, 13, 27);
			this.createLights();
			this.createRoom();
			this.scene.add(this.breakablesRoot);
			this.createBreakables();
			this.syncUpstairsVisibility();
			this.syncBiomeState(true);
			await this.loadRabbit();

			this.camera.position.copy(CAMERA_HOME);
			this.camera.lookAt(CAMERA_TARGET);
			this.resizeObserver = new ResizeObserver(() => this.resize());
			this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
			window.addEventListener('keydown', this.keyDownHandler, { passive: false });
			window.addEventListener('keyup', this.keyUpHandler, { passive: false });
			window.addEventListener('blur', this.blurHandler);
			this.resize();
			this.timer.connect(document);
			this.timer.reset();
			this.animate();
			this.emitHud(true);
			this.callbacks.onReady();
		} catch (error) {
			console.error(error);
			this.callbacks.onError(
				'Het konijn kon de kamer niet binnenkomen. Probeer de pagina opnieuw.'
			);
		}
	}

	start() {
		this.clearDebris();
		this.clearSurfaceCracks();
		this.clearWeaponProjectiles();
		this.clearMuzzleEffects();
		this.muzzleGlowTexture?.dispose();
		this.muzzleGlowTexture = null;
		this.muzzleSmokeTexture?.dispose();
		this.muzzleSmokeTexture = null;
		this.clearBulletHoles();
		this.resetBreakables();
		this.player.position.set(0, 0, 2.4);
		this.player.rotation.set(0, Math.PI, 0);
		this.camera.position.copy(CAMERA_HOME);
		this.cameraLookTarget.copy(CAMERA_TARGET);
		this.camera.lookAt(CAMERA_TARGET);
		this.rabbitTumble.rotation.set(0, 0, 0);
		this.velocity.set(0, 0, 0);
		this.pointerActive = false;
		this.stomping = false;
		this.stompWindup = 0;
		this.stompTimeout = 0;
		this.stampSequence = 0;
		this.pendingStampFeedback = '';
		this.stampTargetsWindow = false;
		this.stampTargetsDoor = false;
		this.stampTargetLeftDoor = null;
		this.stampPose.identity();
		this.resetArmRagdolls();
		this.score = 0;
		this.destroyedCount = 0;
		this.lastHit = '';
		this.lastValue = 0;
		this.phase = 'playing';
		this.paused = false;
		this.weapon = 'poop';
		this.weaponCooldown = 0;
		this.weaponHeld = false;
		this.syncWeaponModel();
		this.velocity.y = 6.4;
		this.joltArms(1.1);
		this.timer.reset();
		this.playSound('start');
		this.emitHud(true);
	}

	cycleWeapon() {
		this.weaponHeld = false;
		this.weapon = this.weapon === 'poop' ? 'pistol' : 'poop';
		this.syncWeaponModel();
		this.emitHud(true);
	}

	beginUseWeapon() {
		if (this.phase !== 'playing' || this.paused) return;
		this.weaponHeld = true;
		this.useWeapon();
	}

	endUseWeapon() {
		this.weaponHeld = false;
	}

	useWeapon() {
		if (this.phase !== 'playing' || this.paused || this.weaponCooldown > 0) return;
		this.ensureAudio();
		this.weaponCooldown = WEAPON_COOLDOWNS[this.weapon];
		if (this.weapon === 'poop') this.firePoopBoost();
		else this.firePistol();
		this.emitHud(true);
	}

	setPointerTarget(clientX: number, clientY: number) {
		const bounds = this.canvas.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return;
		this.pointerNdc.set(
			((clientX - bounds.left) / bounds.width) * 2 - 1,
			-((clientY - bounds.top) / bounds.height) * 2 + 1
		);
		this.pointerActive = true;
	}

	clearPointerTarget() {
		this.pointerActive = false;
	}

	beginStampAt(clientX: number, clientY: number) {
		if (this.phase !== 'playing' || this.paused || this.stomping) return;
		this.setPointerTarget(clientX, clientY);
		const target = this.raycastStampSurface();
		if (!target) return;

		const playerCenter = this.player.position
			.clone()
			.add(new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0));
		this.stampTargetKind = target.kind;
		this.stampTargetsWindow = this.windowStampSurfaces.includes(target.object);
		this.stampTargetsDoor = this.doorStampSurfaces.includes(target.object);
		this.stampTargetLeftDoor =
			this.leftRoomDoors.find((door) => door.surfaces.includes(target.object)) ?? null;
		if (target.kind === 'floor') {
			this.stampDirection.set(0, -1, 0);
		} else {
			this.stampDirection.copy(target.point).sub(playerCenter).normalize();
		}
		this.stampTargetNormal.copy(target.normal);
		const localStampDirection = this.stampDirection
			.clone()
			.applyQuaternion(this.player.getWorldQuaternion(new THREE.Quaternion()).invert());
		this.stampPose.setFromUnitVectors(new THREE.Vector3(0, -1, 0), localStampDirection);
		this.ensureAudio();
		this.stampSequence += 1;
		this.pendingStampFeedback = '';
		this.stomping = true;
		this.stompWindup = 0.08;
		this.stompTimeout = 2.2;
		if (target.kind === 'floor') this.velocity.y *= 0.45;
		else this.velocity.multiplyScalar(0.45);
		this.joltArms(0.7);
	}

	togglePause() {
		if (this.phase !== 'playing') return;
		this.paused = !this.paused;
		this.emitHud(true);
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		for (const sample of this.activeSamples) sample.muted = muted;
	}

	setReducedMotion(reduced: boolean) {
		this.reducedMotion = reduced;
		if (reduced) this.cameraShake = 0;
	}

	destroy() {
		cancelAnimationFrame(this.frame);
		this.timer.dispose();
		this.resizeObserver?.disconnect();
		window.removeEventListener('keydown', this.keyDownHandler);
		window.removeEventListener('keyup', this.keyUpHandler);
		window.removeEventListener('blur', this.blurHandler);
		for (const sample of this.activeSamples) sample.pause();
		this.activeSamples.clear();
		this.clearDebris();
		this.clearSurfaceCracks();
		this.clearWeaponProjectiles();
		this.clearMuzzleEffects();
		this.muzzleGlowTexture?.dispose();
		this.muzzleGlowTexture = null;
		this.muzzleSmokeTexture?.dispose();
		this.muzzleSmokeTexture = null;
		this.clearBulletHoles();
		disposeObject(this.scene);
		this.renderer.dispose();
		void this.audioContext?.close();
	}

	private createLights() {
		this.groundHemisphere = new THREE.HemisphereLight(0xf8f2df, 0x6f655f, 2.1);
		this.scene.add(this.groundHemisphere);

		this.groundSun = new THREE.DirectionalLight(0xfff3dc, 3.2);
		this.groundSun.position.set(7, 13, 5);
		this.groundSun.target.position.set(0, 0, -9);
		this.groundSun.castShadow = true;
		this.groundSun.shadow.mapSize.set(2048, 2048);
		this.groundSun.shadow.camera.left = -18;
		this.groundSun.shadow.camera.right = 18;
		this.groundSun.shadow.camera.top = 16;
		this.groundSun.shadow.camera.bottom = -12;
		this.groundSun.shadow.camera.far = 45;
		this.scene.add(this.groundSun, this.groundSun.target);

		this.groundWindowGlow = new THREE.PointLight(0xffb868, 28, 11, 2);
		this.groundWindowGlow.position.set(-5, 3.3, 1.5);
		this.scene.add(this.groundWindowGlow);
	}

	private createRoom() {
		const floor = shadowMesh(
			new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
			material(COLORS.floor)
		);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.scene.add(floor);
		this.bulletImpactSurfaces.push(floor);
		this.stampSurfaceKinds.set(floor, 'floor');

		const rug = shadowMesh(new THREE.CircleGeometry(2.8, 64), material(COLORS.rug, 0.95));
		rug.scale.z = 0.62;
		rug.rotation.x = -Math.PI / 2;
		rug.position.set(0, 0.018, 1.1);
		this.scene.add(rug);

		const windowLeft = WINDOW_CENTER_X - WINDOW_WIDTH / 2;
		const windowRight = WINDOW_CENTER_X + WINDOW_WIDTH / 2;
		const windowBottom = WINDOW_CENTER_Y - WINDOW_HEIGHT / 2;
		const windowTop = WINDOW_CENTER_Y + WINDOW_HEIGHT / 2;
		const backWallPanels = [
			box(
				[windowLeft + ROOM_WIDTH / 2, ROOM_HEIGHT, 0.18],
				[(-ROOM_WIDTH / 2 + windowLeft) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z],
				COLORS.wallWarm
			),
			box(
				[ROOM_WIDTH / 2 - windowRight, ROOM_HEIGHT, 0.18],
				[(windowRight + ROOM_WIDTH / 2) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z],
				COLORS.wallWarm
			),
			box(
				[WINDOW_WIDTH, windowBottom, 0.18],
				[WINDOW_CENTER_X, windowBottom / 2, BACK_WALL_Z],
				COLORS.wallWarm
			),
			box(
				[WINDOW_WIDTH, ROOM_HEIGHT - windowTop, 0.18],
				[WINDOW_CENTER_X, (windowTop + ROOM_HEIGHT) / 2, BACK_WALL_Z],
				COLORS.wallWarm
			)
		];
		for (const panel of backWallPanels) {
			panel.receiveShadow = true;
			this.scene.add(panel);
			this.bulletImpactSurfaces.push(panel);
			this.stampSurfaceKinds.set(panel, 'wall');
		}

		for (let x = -5.6; x <= 5.6; x += 1.4) {
			const seam = box([0.025, 0.008, ROOM_DEPTH - 0.3], [x, 0.024, 0], 0x8e6048);
			seam.receiveShadow = false;
			this.scene.add(seam);
		}

		const windowFrame = new THREE.Group();
		windowFrame.add(box([WINDOW_WIDTH, 0.14, 0.2], [0, WINDOW_HEIGHT / 2, 0], COLORS.ink));
		windowFrame.add(box([WINDOW_WIDTH, 0.14, 0.2], [0, -WINDOW_HEIGHT / 2, 0], COLORS.ink));
		windowFrame.add(box([0.14, WINDOW_HEIGHT, 0.2], [-WINDOW_WIDTH / 2, 0, 0], COLORS.ink));
		windowFrame.add(box([0.14, WINDOW_HEIGHT, 0.2], [WINDOW_WIDTH / 2, 0, 0], COLORS.ink));

		this.windowBreakaway = new THREE.Group();
		const glass = new THREE.Mesh(
			new THREE.PlaneGeometry(WINDOW_OPENING_WIDTH, WINDOW_OPENING_HEIGHT),
			new THREE.MeshStandardMaterial({
				color: 0x8dc0d2,
				roughness: 0.18,
				metalness: 0.04,
				transparent: true,
				opacity: 0.58,
				side: THREE.DoubleSide
			})
		);
		glass.position.z = 0.025;
		glass.receiveShadow = true;
		this.windowBreakaway.add(glass);
		this.windowBreakaway.add(box([0.07, WINDOW_OPENING_HEIGHT, 0.1], [0, 0, 0.06], COLORS.cream));
		this.windowBreakaway.add(box([WINDOW_OPENING_WIDTH, 0.07, 0.1], [0, 0, 0.06], COLORS.cream));
		this.windowStampSurfaces = [glass];
		this.setWindowCollisionEnabled(true);
		windowFrame.add(this.windowBreakaway);
		windowFrame.position.set(WINDOW_CENTER_X, WINDOW_CENTER_Y, BACK_WALL_Z + 0.18);
		this.scene.add(windowFrame);

		const skirting = box([ROOM_WIDTH - 0.2, 0.22, 0.16], [0, 0.11, -4.84], COLORS.cream);
		this.scene.add(skirting);
		this.createLeftRooms();
		this.createKitchen();
		this.createRoomRevealMasks();
		this.createBasement();
		this.createSewer();
		this.createUpstairs();
		this.createGarden();
	}

	private createRoomRevealMasks() {
		this.kitchenRevealMask = new THREE.Group();
		this.kitchenRevealMask.add(
			box(
				[KITCHEN_WIDTH - 0.08, ROOM_HEIGHT, 0.14],
				[KITCHEN_CENTER_X, ROOM_HEIGHT / 2, ROOM_DEPTH / 2 + 0.07],
				0xd8c7b4
			),
			box(
				[KITCHEN_WIDTH - 0.08, 0.14, ROOM_DEPTH - 0.08],
				[KITCHEN_CENTER_X, ROOM_HEIGHT + 0.07, 0],
				0xd8c7b4
			)
		);
		this.scene.add(this.kitchenRevealMask);

		this.leftRoomRevealMasks.clear();
		const roomSections: Array<{
			room: LeftRoomName;
			minZ: number;
			maxZ: number;
			color: number;
		}> = [
			{ room: 'bathroom', minZ: BACK_WALL_Z, maxZ: BATHROOM_MAX_Z, color: 0xd7e2df },
			{ room: 'stairs', minZ: BATHROOM_MAX_Z, maxZ: BEDROOM_MIN_Z, color: 0xd8c7b4 },
			{ room: 'bedroom', minZ: BEDROOM_MIN_Z, maxZ: ROOM_DEPTH / 2, color: 0xe2d0c1 }
		];
		for (const section of roomSections) {
			const mask = new THREE.Group();
			const depth = section.maxZ - section.minZ;
			mask.add(
				box(
					[LEFT_ROOMS_WIDTH - 0.08, 0.14, depth - 0.06],
					[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT + 0.07, (section.minZ + section.maxZ) / 2],
					section.color
				)
			);
			if (section.room === 'bedroom') {
				mask.add(
					box(
						[LEFT_ROOMS_WIDTH - 0.08, ROOM_HEIGHT, 0.14],
						[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT / 2, ROOM_DEPTH / 2 + 0.07],
						section.color
					)
				);
			}
			this.leftRoomRevealMasks.set(section.room, mask);
			this.scene.add(mask);
		}
	}

	private createLeftRooms() {
		const doorConfigs: Array<{
			room: LeftRoomName;
			label: string;
			centerZ: number;
			color: number;
		}> = [
			{ room: 'bathroom', label: 'WC', centerZ: BATHROOM_DOOR_Z, color: 0x76a4ae },
			{ room: 'stairs', label: 'TRAP', centerZ: STAIRS_DOOR_Z, color: 0xd1a64d },
			{ room: 'bedroom', label: 'SLAAPKAMER', centerZ: BEDROOM_DOOR_Z, color: 0xb77875 }
		];

		let wallCursor = BACK_WALL_Z;
		for (const config of doorConfigs) {
			const doorMinZ = config.centerZ - LEFT_ROOM_DOOR_WIDTH / 2;
			const panelDepth = doorMinZ - wallCursor;
			if (panelDepth > 0.01) {
				const panel = box(
					[0.18, ROOM_HEIGHT, panelDepth],
					[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, wallCursor + panelDepth / 2],
					COLORS.wall
				);
				panel.receiveShadow = true;
				this.scene.add(panel);
				this.bulletImpactSurfaces.push(panel);
				this.stampSurfaceKinds.set(panel, 'wall');
			}
			const header = box(
				[0.18, ROOM_HEIGHT - LEFT_ROOM_DOOR_HEIGHT, LEFT_ROOM_DOOR_WIDTH],
				[
					-ROOM_WIDTH / 2,
					LEFT_ROOM_DOOR_HEIGHT + (ROOM_HEIGHT - LEFT_ROOM_DOOR_HEIGHT) / 2,
					config.centerZ
				],
				COLORS.wall
			);
			header.receiveShadow = true;
			this.scene.add(header);
			this.bulletImpactSurfaces.push(header);
			this.stampSurfaceKinds.set(header, 'wall');
			wallCursor = config.centerZ + LEFT_ROOM_DOOR_WIDTH / 2;
		}
		const finalPanelDepth = ROOM_DEPTH / 2 - wallCursor;
		if (finalPanelDepth > 0.01) {
			const panel = box(
				[0.18, ROOM_HEIGHT, finalPanelDepth],
				[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, wallCursor + finalPanelDepth / 2],
				COLORS.wall
			);
			panel.receiveShadow = true;
			this.scene.add(panel);
			this.bulletImpactSurfaces.push(panel);
			this.stampSurfaceKinds.set(panel, 'wall');
		}

		const roomFloors: Array<{
			room: LeftRoomName;
			minZ: number;
			maxZ: number;
			color: number;
		}> = [
			{ room: 'bathroom', minZ: BACK_WALL_Z, maxZ: BATHROOM_MAX_Z, color: 0xb9d1cf },
			{ room: 'stairs', minZ: BATHROOM_MAX_Z, maxZ: BEDROOM_MIN_Z, color: 0x9a704e },
			{ room: 'bedroom', minZ: BEDROOM_MIN_Z, maxZ: ROOM_DEPTH / 2, color: 0xc49087 }
		];
		for (const room of roomFloors) {
			const depth = room.maxZ - room.minZ;
			const floor = shadowMesh(
				new THREE.PlaneGeometry(LEFT_ROOMS_WIDTH, depth),
				material(room.color, 0.94)
			);
			floor.rotation.x = -Math.PI / 2;
			floor.position.set(LEFT_ROOMS_CENTER_X, -0.003, (room.minZ + room.maxZ) / 2);
			floor.receiveShadow = true;
			this.scene.add(floor);
			this.bulletImpactSurfaces.push(floor);
			this.stampSurfaceKinds.set(floor, 'floor');
		}

		for (let x = LEFT_ROOMS_MIN_X + 0.55; x < LEFT_ROOMS_MAX_X; x += 0.55) {
			const seam = box(
				[0.016, 0.008, BATHROOM_MAX_Z - BACK_WALL_Z - 0.12],
				[x, 0.018, (BACK_WALL_Z + BATHROOM_MAX_Z) / 2],
				0x8ba9a7
			);
			seam.receiveShadow = false;
			this.scene.add(seam);
		}
		for (let z = BACK_WALL_Z + 0.55; z < BATHROOM_MAX_Z; z += 0.55) {
			const seam = box(
				[LEFT_ROOMS_WIDTH - 0.12, 0.008, 0.016],
				[LEFT_ROOMS_CENTER_X, 0.019, z],
				0x8ba9a7
			);
			seam.receiveShadow = false;
			this.scene.add(seam);
		}

		const outerWall = box(
			[0.18, ROOM_HEIGHT, ROOM_DEPTH],
			[LEFT_ROOMS_MIN_X, ROOM_HEIGHT / 2, 0],
			0xd8c7b4
		);
		const bathroomBackWall = box(
			[LEFT_ROOMS_WIDTH, ROOM_HEIGHT, 0.18],
			[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT / 2, BACK_WALL_Z],
			0xd7e2df
		);
		const bathroomDivider = box(
			[LEFT_ROOMS_WIDTH, ROOM_HEIGHT, 0.18],
			[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT / 2, BATHROOM_MAX_Z],
			0xd7e2df
		);
		const bedroomDivider = box(
			[LEFT_ROOMS_WIDTH, ROOM_HEIGHT, 0.18],
			[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT / 2, BEDROOM_MIN_Z],
			0xe2d0c1
		);
		for (const wall of [outerWall, bathroomBackWall, bathroomDivider, bedroomDivider]) {
			wall.receiveShadow = true;
			this.scene.add(wall);
			this.bulletImpactSurfaces.push(wall);
			this.stampSurfaceKinds.set(wall, 'wall');
		}

		const handBasinX = -8.75;
		const handBasinZ = BACK_WALL_Z + 0.43;
		const basinSupport = box([0.68, 0.58, 0.38], [handBasinX, 0.34, handBasinZ - 0.08], 0x6b8e88);
		const basin = shadowMesh(new THREE.SphereGeometry(0.34, 18, 10), material(0xe6e2d8, 0.42));
		basin.scale.set(1.08, 0.32, 0.7);
		basin.position.set(handBasinX, 0.72, handBasinZ);
		const drainPipe = cylinder(0.055, 0.055, 0.48, [handBasinX, 0.25, handBasinZ], 0x777a78, 10);
		const tapStem = cylinder(
			0.035,
			0.035,
			0.24,
			[handBasinX, 0.98, handBasinZ - 0.1],
			0x777a78,
			10
		);
		const tapSpout = cylinder(0.032, 0.032, 0.2, [handBasinX, 1.08, handBasinZ], 0x777a78, 10);
		tapSpout.rotation.x = Math.PI / 2;
		const tapHandle = box([0.2, 0.035, 0.055], [handBasinX, 1.12, handBasinZ - 0.1], 0x777a78);
		const mirror = box([0.74, 0.82, 0.035], [handBasinX, 1.7, BACK_WALL_Z + 0.12], 0x88b4bd);
		this.scene.add(basinSupport, basin, drainPipe, tapStem, tapSpout, tapHandle, mirror);
		this.createToiletRoomDecor();

		for (let index = 0; index < STAIR_STRAIGHT_STEP_COUNT; index += 1) {
			const stepHeight = STAIR_STEP_RISE * (index + 1);
			const step = box(
				[STAIR_STEP_RUN, stepHeight, 2.35],
				[-7.55 - index * STAIR_STEP_RUN, stepHeight / 2, 0],
				index % 2 === 0 ? 0x956743 : 0xa47750
			);
			this.scene.add(step);
		}
		for (let index = 0; index < STAIR_TURN_STEP_COUNT; index += 1) {
			const stepHeight = STAIR_STEP_RISE * (STAIR_STRAIGHT_STEP_COUNT + index + 1);
			const turnStep = box(
				[1.42, stepHeight, 0.5],
				[-12.46, stepHeight / 2, -0.45 - index * 0.5],
				index % 2 === 0 ? 0xa47750 : 0x956743
			);
			this.scene.add(turnStep);
		}
		const turnPost = cylinder(0.075, 0.075, 4.45, [-11.73, 2.23, -0.18], 0x3d3029, 10);
		const turnRail = cylinder(0.055, 0.055, 1.16, [-11.73, 4.18, -0.72], 0x3d3029, 10);
		turnRail.rotation.x = Math.PI / 2;
		const stairRail = cylinder(0.055, 0.055, 5.15, [-10.1, 2.15, -1.06], 0x3d3029, 10);
		stairRail.rotation.z = Math.PI / 2 - 0.64;
		this.scene.add(stairRail, turnPost, turnRail);

		const wardrobe = box([0.82, 2.2, 1.35], [LEFT_ROOMS_MIN_X + 0.52, 1.1, 3.25], 0x7d5a46);
		const bedroomRug = shadowMesh(new THREE.CircleGeometry(1.2, 32), material(0x725c72, 0.95));
		bedroomRug.scale.z = 0.64;
		bedroomRug.rotation.x = -Math.PI / 2;
		bedroomRug.position.set(-9.15, 0.015, 3.5);
		this.scene.add(wardrobe, bedroomRug);

		for (const config of doorConfigs) {
			this.createLeftRoomDoor(config.room, config.label, config.centerZ, config.color);
		}
	}

	private createUpstairs() {
		this.upstairsRoot.visible = false;
		this.scene.add(this.upstairsRoot);
		const upstairsWidth = UPSTAIRS_MAX_X - UPSTAIRS_MIN_X;
		const floor = shadowMesh(
			new THREE.BoxGeometry(upstairsWidth, 0.08, ROOM_DEPTH),
			material(0x30342f, 0.9)
		);
		floor.position.set(UPSTAIRS_CENTER_X, UPSTAIRS_FLOOR_Y - 0.02, 0);
		floor.receiveShadow = true;
		this.upstairsRoot.add(floor);
		this.bulletImpactSurfaces.push(floor);
		this.stampSurfaceKinds.set(floor, 'floor');

		for (let x = UPSTAIRS_MIN_X + 0.9; x < UPSTAIRS_MAX_X; x += 0.9) {
			this.upstairsRoot.add(
				box([0.025, 0.012, ROOM_DEPTH - 0.24], [x, UPSTAIRS_FLOOR_Y + 0.026, 0], 0x20241f)
			);
		}

		const upstairsHeight = ROOM_HEIGHT;
		const walls = [
			box(
				[0.2, upstairsHeight, ROOM_DEPTH],
				[UPSTAIRS_MIN_X, UPSTAIRS_FLOOR_Y + upstairsHeight / 2, 0],
				0x454942
			),
			box(
				[0.2, upstairsHeight, ROOM_DEPTH],
				[UPSTAIRS_MAX_X, UPSTAIRS_FLOOR_Y + upstairsHeight / 2, 0],
				0x454942
			),
			box(
				[upstairsWidth, upstairsHeight, 0.2],
				[UPSTAIRS_CENTER_X, UPSTAIRS_FLOOR_Y + upstairsHeight / 2, BACK_WALL_Z],
				0x383d38
			)
		];
		for (const wall of walls) {
			wall.receiveShadow = true;
			this.upstairsRoot.add(wall);
			this.bulletImpactSurfaces.push(wall);
			this.stampSurfaceKinds.set(wall, 'wall');
		}

		const stairwell = box(
			[1.78, 0.035, 1.42],
			[UPSTAIRS_STAIRWELL_X, UPSTAIRS_FLOOR_Y + 0.022, -0.67],
			0x332b27
		);
		const landingRail = box(
			[0.12, 0.92, 1.58],
			[UPSTAIRS_STAIRWELL_X + 0.94, UPSTAIRS_FLOOR_Y + 0.46, -0.62],
			0x1c211e
		);
		const landingRailTop = box(
			[1.92, 0.1, 0.12],
			[UPSTAIRS_STAIRWELL_X, UPSTAIRS_FLOOR_Y + 0.92, 0.08],
			0x1c211e
		);
		this.upstairsRoot.add(stairwell, landingRail, landingRailTop);

		for (const x of [-8.6, 0.2, 9]) {
			const beam = box(
				[0.08, 0.08, ROOM_DEPTH - 0.5],
				[x, UPSTAIRS_FLOOR_Y + 4.25, 0],
				0x171b18
			);
			this.upstairsRoot.add(beam);
		}

		this.createKo9HideoutDecor();

		const monitorGlow = new THREE.PointLight(0x58c8b5, 0, 6.5, 2);
		monitorGlow.position.set(0.45, UPSTAIRS_FLOOR_Y + 2.2, -1.15);
		const archiveLight = new THREE.PointLight(0xf0a85c, 0, 5.6, 2);
		archiveLight.position.set(-7.8, UPSTAIRS_FLOOR_Y + 3.25, -2.15);
		const armoryLight = new THREE.PointLight(0xe66045, 0, 5.4, 2);
		armoryLight.position.set(9.2, UPSTAIRS_FLOOR_Y + 3.15, -2.5);
		this.upstairsLights.push(monitorGlow, archiveLight, armoryLight);
		this.upstairsRoot.add(...this.upstairsLights);
	}

	private createKo9HideoutDecor() {
		const brand = this.makeKo9WallPanel(5.2, 0.82, 'brand');
		brand.position.set(0.3, UPSTAIRS_FLOOR_Y + 3.82, BACK_WALL_Z + 0.12);
		this.upstairsRoot.add(brand);

		const targets = this.makeKo9WallPanel(3.9, 2.05, 'targets');
		targets.position.set(-7.1, UPSTAIRS_FLOOR_Y + 2.62, BACK_WALL_Z + 0.125);
		this.upstairsRoot.add(targets);

		const network = this.makeKo9WallPanel(5.2, 2.25, 'network');
		network.position.set(0.2, UPSTAIRS_FLOOR_Y + 2.45, BACK_WALL_Z + 0.125);
		this.upstairsRoot.add(network);

		const restricted = this.makeKo9WallPanel(2.55, 0.8, 'restricted');
		restricted.position.set(10.7, UPSTAIRS_FLOOR_Y + 3.66, BACK_WALL_Z + 0.125);
		this.upstairsRoot.add(restricted);

		const cableTray = box(
			[17.8, 0.1, 0.12],
			[1.6, UPSTAIRS_FLOOR_Y + 0.36, BACK_WALL_Z + 0.18],
			0x181c19
		);
		this.upstairsRoot.add(cableTray);
	}

	private createBasement() {
		this.basementRoot = new THREE.Group();
		this.basementRoot.visible = false;
		this.scene.add(this.basementRoot);
		const basementWidth = BASEMENT_MAX_X - BASEMENT_MIN_X;
		const basementFloor = shadowMesh(
			new THREE.PlaneGeometry(basementWidth, ROOM_DEPTH),
			material(0x63503b, 1)
		);
		basementFloor.rotation.x = -Math.PI / 2;
		basementFloor.position.set(BASEMENT_CENTER_X, BASEMENT_FLOOR_Y, 0);
		basementFloor.receiveShadow = true;
		this.basementRoot.add(basementFloor);
		this.bulletImpactSurfaces.push(basementFloor);
		this.stampSurfaceKinds.set(basementFloor, 'floor');

		const basementHeight = Math.abs(BASEMENT_FLOOR_Y) + 0.1;
		const basementWalls = [
			box(
				[0.22, basementHeight, ROOM_DEPTH],
				[BASEMENT_MIN_X, BASEMENT_FLOOR_Y + basementHeight / 2, 0],
				0x443a31
			),
			box(
				[0.22, basementHeight, ROOM_DEPTH],
				[BASEMENT_MAX_X, BASEMENT_FLOOR_Y + basementHeight / 2, 0],
				0x443a31
			),
			box(
				[basementWidth, basementHeight, 0.22],
				[BASEMENT_CENTER_X, BASEMENT_FLOOR_Y + basementHeight / 2, BACK_WALL_Z],
				0x3b332c
			)
		];
		for (const wall of basementWalls) {
			this.basementRoot.add(wall);
			this.bulletImpactSurfaces.push(wall);
			this.stampSurfaceKinds.set(wall, 'wall');
		}
		this.createBasementStairs();

		for (let index = 0; index < 18; index += 1) {
			const x = BASEMENT_MIN_X + 0.7 + ((index * 3.17) % (basementWidth - 1.4));
			const z = BACK_WALL_Z + 0.55 + ((index * 2.41) % (ROOM_DEPTH - 1.1));
			const mound = shadowMesh(
				new THREE.SphereGeometry(0.65 + (index % 3) * 0.14, 12, 7),
				material(index % 2 === 0 ? 0x7a6042 : 0x6e563d, 1)
			);
			mound.scale.set(1.35 + (index % 4) * 0.18, 0.16 + (index % 3) * 0.035, 0.82);
			mound.position.set(x, BASEMENT_FLOOR_Y - 0.03, z);
			mound.receiveShadow = true;
			this.basementRoot.add(mound);
		}

		for (let index = 0; index < 26; index += 1) {
			const rock = shadowMesh(
				new THREE.DodecahedronGeometry(0.07 + (index % 4) * 0.025, 0),
				material(index % 3 === 0 ? 0x493d32 : 0x796249, 1)
			);
			rock.scale.y = 0.55;
			rock.position.set(
				BASEMENT_MIN_X + 0.4 + ((index * 4.11) % (basementWidth - 0.8)),
				BASEMENT_FLOOR_Y + 0.05,
				BACK_WALL_Z + 0.35 + ((index * 3.07) % (ROOM_DEPTH - 0.7))
			);
			this.basementRoot.add(rock);
		}

		for (const x of [-5.3, 1.9, 9.1]) {
			const column = box([0.46, 3.82, 0.46], [x, BASEMENT_FLOOR_Y + 1.91, -0.2], 0x55564f);
			const beam = box([0.62, 0.34, ROOM_DEPTH - 0.35], [x, -0.2, 0], 0x4d4239);
			this.basementRoot.add(column, beam);
		}

		const boiler = cylinder(0.68, 0.72, 2.25, [11.8, BASEMENT_FLOOR_Y + 1.13, -3.55], 0x7e6654, 20);
		const boilerPipe = cylinder(
			0.13,
			0.13,
			1.55,
			[11.8, BASEMENT_FLOOR_Y + 2.95, -3.55],
			0x76503a,
			12
		);
		this.basementRoot.add(boiler, boilerPipe);
		this.basementRoot.add(
			box([1.05, 0.92, 0.82], [-5.2, BASEMENT_FLOOR_Y + 0.46, -3.6], 0x7a573d, 0.16),
			box([0.86, 0.7, 0.72], [-4.25, BASEMENT_FLOOR_Y + 0.35, -3.35], 0x8b6548, -0.12),
			box([1.35, 1.72, 0.42], [7.8, BASEMENT_FLOOR_Y + 0.86, -4.45], 0x4e514b)
		);

		this.toiletHole = new THREE.Group();
		this.toiletHole.position.set(TOILET_X, 0, TOILET_Z);
		const toiletDarkness = new THREE.Mesh(
			new THREE.CircleGeometry(TOILET_HOLE_RADIUS, 32),
			new THREE.MeshBasicMaterial({ color: 0x171814, side: THREE.DoubleSide })
		);
		toiletDarkness.rotation.x = -Math.PI / 2;
		toiletDarkness.position.y = 0.024;
		const toiletRim = shadowMesh(
			new THREE.TorusGeometry(TOILET_HOLE_RADIUS, 0.09, 10, 32),
			material(0x4a4841, 0.98)
		);
		toiletRim.rotation.x = Math.PI / 2;
		toiletRim.position.y = 0.038;
		this.toiletHole.add(toiletDarkness, toiletRim);
		this.toiletHole.visible = false;
		this.scene.add(this.toiletHole);

		this.kitchenHatchHole = new THREE.Group();
		this.kitchenHatchHole.position.set(KITCHEN_HATCH_X, 0, KITCHEN_HATCH_Z);
		const hatchDarkness = new THREE.Mesh(
			new THREE.PlaneGeometry(KITCHEN_HATCH_WIDTH - 0.1, KITCHEN_HATCH_DEPTH - 0.1),
			new THREE.MeshBasicMaterial({ color: 0x151612, side: THREE.DoubleSide })
		);
		hatchDarkness.rotation.x = -Math.PI / 2;
		hatchDarkness.position.y = 0.025;
		this.kitchenHatchHole.add(
			hatchDarkness,
			box([KITCHEN_HATCH_WIDTH + 0.16, 0.1, 0.11], [0, 0.05, -KITCHEN_HATCH_DEPTH / 2], 0x493427),
			box([KITCHEN_HATCH_WIDTH + 0.16, 0.1, 0.11], [0, 0.05, KITCHEN_HATCH_DEPTH / 2], 0x493427),
			box([0.11, 0.1, KITCHEN_HATCH_DEPTH], [-KITCHEN_HATCH_WIDTH / 2, 0.05, 0], 0x493427),
			box([0.11, 0.1, KITCHEN_HATCH_DEPTH], [KITCHEN_HATCH_WIDTH / 2, 0.05, 0], 0x493427)
		);
		this.kitchenHatchHole.visible = false;
		this.scene.add(this.kitchenHatchHole);

		this.basementLights = [
			new THREE.PointLight(0xd69a51, 0, 10, 2),
			new THREE.PointLight(0x7f8d6b, 0, 9, 2)
		];
		this.basementLights[0].position.set(-4, BASEMENT_FLOOR_Y + 2.7, 0.8);
		this.basementLights[1].position.set(9.5, BASEMENT_FLOOR_Y + 2.55, -1.4);
		this.basementRoot.add(...this.basementLights);
	}

	private createBasementStairs() {
		const treadThickness = 0.11;
		const treadColor = 0x8a5b36;
		const alternateTreadColor = 0x765033;
		const frameColor = 0x4e3324;
		for (let index = 0; index < BASEMENT_STAIR_STEP_COUNT; index += 1) {
			const x = BASEMENT_STAIR_BOTTOM_X + index * BASEMENT_STAIR_RUN;
			const topY = BASEMENT_FLOOR_Y + (index + 1) * BASEMENT_STAIR_RISE;
			const tread = box(
				[BASEMENT_STAIR_RUN + 0.04, treadThickness, BASEMENT_STAIR_WIDTH],
				[x, topY - treadThickness / 2, KITCHEN_HATCH_Z],
				index % 2 === 0 ? treadColor : alternateTreadColor
			);
			const riser = box(
				[0.09, BASEMENT_STAIR_RISE - treadThickness, BASEMENT_STAIR_WIDTH - 0.08],
				[
					x - BASEMENT_STAIR_RUN / 2,
					topY - (BASEMENT_STAIR_RISE + treadThickness) / 2,
					KITCHEN_HATCH_Z
				],
				frameColor
			);
			this.basementRoot.add(tread, riser);
			this.bulletImpactSurfaces.push(tread, riser);
			this.stampSurfaceKinds.set(tread, 'floor');
			this.stampSurfaceKinds.set(riser, 'wall');
		}

		const stairRun = (BASEMENT_STAIR_STEP_COUNT - 1) * BASEMENT_STAIR_RUN;
		const stairRise = (BASEMENT_STAIR_STEP_COUNT - 1) * BASEMENT_STAIR_RISE;
		const stairLength = Math.hypot(stairRun, stairRise);
		const stairAngle = Math.atan2(stairRise, stairRun);
		const stairCenterX = (BASEMENT_STAIR_BOTTOM_X + KITCHEN_HATCH_X) / 2;
		const bottomStepY = BASEMENT_FLOOR_Y + BASEMENT_STAIR_RISE;
		const topStepY = BASEMENT_FLOOR_Y + BASEMENT_STAIR_STEP_COUNT * BASEMENT_STAIR_RISE;
		const stairCenterY = (bottomStepY + topStepY) / 2;
		for (const zOffset of [-BASEMENT_STAIR_WIDTH / 2 + 0.08, BASEMENT_STAIR_WIDTH / 2 - 0.08]) {
			const stringer = box(
				[stairLength, 0.14, 0.13],
				[stairCenterX, stairCenterY - 0.2, KITCHEN_HATCH_Z + zOffset],
				frameColor
			);
			stringer.rotation.z = stairAngle;
			this.basementRoot.add(stringer);
		}

		const railZ = KITCHEN_HATCH_Z + BASEMENT_STAIR_WIDTH / 2 + 0.08;
		for (let index = 0; index < BASEMENT_STAIR_STEP_COUNT; index += 2) {
			const x = BASEMENT_STAIR_BOTTOM_X + index * BASEMENT_STAIR_RUN;
			const topY = BASEMENT_FLOOR_Y + (index + 1) * BASEMENT_STAIR_RISE;
			this.basementRoot.add(cylinder(0.035, 0.045, 0.82, [x, topY + 0.41, railZ], frameColor, 8));
		}
		const handrailDirection = new THREE.Vector3(stairRun, stairRise, 0).normalize();
		const handrail = cylinder(
			0.05,
			0.05,
			stairLength + 0.18,
			[stairCenterX, stairCenterY + 0.82, railZ],
			frameColor,
			10
		);
		handrail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), handrailDirection);
		this.basementRoot.add(handrail);
	}

	private createSewer() {
		this.sewerRoot = new THREE.Group();
		this.sewerRoot.visible = false;
		this.scene.add(this.sewerRoot);
		const sewerFloor = shadowMesh(
			new THREE.PlaneGeometry(SEWER_WIDTH, SEWER_DEPTH),
			material(0x303932, 1)
		);
		sewerFloor.rotation.x = -Math.PI / 2;
		sewerFloor.position.set(SEWER_CENTER_X, SEWER_FLOOR_Y, SEWER_CENTER_Z);
		sewerFloor.receiveShadow = true;
		this.sewerRoot.add(sewerFloor);
		this.bulletImpactSurfaces.push(sewerFloor);
		this.stampSurfaceKinds.set(sewerFloor, 'floor');

		const sewerWalls = [
			box(
				[0.18, SEWER_HEIGHT, SEWER_DEPTH],
				[SEWER_MIN_X, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, SEWER_CENTER_Z],
				0x343c36
			),
			box(
				[0.28, SEWER_HEIGHT, SEWER_DEPTH],
				[SEWER_MAX_X, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, SEWER_CENTER_Z],
				0x5a4b3b
			),
			box(
				[SEWER_WIDTH, SEWER_HEIGHT, 0.18],
				[SEWER_CENTER_X, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, SEWER_MIN_Z],
				0x3a423b
			)
		];
		for (const wall of sewerWalls) {
			this.sewerRoot.add(wall);
			this.bulletImpactSurfaces.push(wall);
			this.stampSurfaceKinds.set(wall, 'wall');
		}

		const shaftMinX = TOILET_X - SEWER_SHAFT_HALF_WIDTH;
		const shaftMaxX = TOILET_X + SEWER_SHAFT_HALF_WIDTH;
		for (const [minX, maxX] of [
			[SEWER_MIN_X, shaftMinX],
			[shaftMaxX, SEWER_MAX_X]
		] as Array<[number, number]>) {
			const width = maxX - minX;
			const roof = box(
				[width, 0.18, SEWER_DEPTH],
				[(minX + maxX) / 2, SEWER_CEILING_Y, SEWER_CENTER_Z],
				0x252d28
			);
			this.sewerRoot.add(roof);
			this.bulletImpactSurfaces.push(roof);
			this.stampSurfaceKinds.set(roof, 'wall');
		}

		this.sewerRoot.add(
			box([SEWER_WIDTH, 0.16, 8], [SEWER_CENTER_X, SEWER_FLOOR_Y - 0.02, SEWER_MAX_Z + 4], 0x303932)
		);
		for (const [minX, maxX] of [
			[SEWER_MIN_X, shaftMinX],
			[shaftMaxX, SEWER_MAX_X]
		] as Array<[number, number]>) {
			this.sewerRoot.add(
				box(
					[maxX - minX, 0.16, 8],
					[(minX + maxX) / 2, SEWER_CEILING_Y + 0.02, SEWER_MAX_Z + 4],
					0x252d28
				)
			);
		}

		const shaftHeight = Math.abs(SEWER_CEILING_Y);
		for (const x of [shaftMinX - 0.08, shaftMaxX + 0.08]) {
			this.sewerRoot.add(
				box(
					[0.16, shaftHeight, SEWER_DEPTH - 0.18],
					[x, SEWER_CEILING_Y + shaftHeight / 2, SEWER_CENTER_Z],
					0x3f473f
				)
			);
		}
		for (const y of [SEWER_CEILING_Y + 0.28, -2.7, -1.3]) {
			const shaftRing = new THREE.Mesh(
				new THREE.TorusGeometry(SEWER_SHAFT_HALF_WIDTH + 0.12, 0.07, 8, 24),
				material(0x76533b, 0.86)
			);
			shaftRing.rotation.x = Math.PI / 2;
			shaftRing.position.set(TOILET_X, y, SEWER_CENTER_Z);
			this.sewerRoot.add(shaftRing);
		}
		const shaftGlow = new THREE.PointLight(0xb9d19b, 5.5, 8, 2);
		shaftGlow.position.set(TOILET_X, -1.3, SEWER_CENTER_Z + 0.2);
		this.sewerRoot.add(shaftGlow);

		const water = shadowMesh(
			new THREE.PlaneGeometry(SEWER_WIDTH - 0.3, 0.58),
			new THREE.MeshStandardMaterial({
				color: 0x627047,
				roughness: 0.58,
				metalness: 0.04,
				transparent: true,
				opacity: 0.88
			})
		);
		water.rotation.x = -Math.PI / 2;
		water.position.set(SEWER_CENTER_X, SEWER_FLOOR_Y + 0.025, SEWER_CENTER_Z - 0.72);
		this.sewerRoot.add(water);

		for (let x = SEWER_MIN_X + 2; x < SEWER_MAX_X; x += 5.2) {
			const pipe = cylinder(
				0.16,
				0.16,
				SEWER_DEPTH - 0.24,
				[x, SEWER_FLOOR_Y + 3.3, SEWER_CENTER_Z - 0.18],
				0x835b3c,
				14
			);
			pipe.rotation.x = Math.PI / 2;
			this.sewerRoot.add(pipe);
		}

		for (let index = 0; index < 16; index += 1) {
			const x = TOILET_X + 6.5 + index * 4.55;
			if (x > SEWER_MAX_X - 5) break;
			const fromFloor = index % 2 === 0 || index % 5 === 3;
			const height = fromFloor ? 1.05 + (index % 3) * 0.18 : 1.12 + (index % 4) * 0.13;
			const centerY = fromFloor ? height / 2 : SEWER_HEIGHT - height / 2;
			this.addSewerObstacle(x, SEWER_FLOOR_Y + centerY, 0.95 + (index % 3) * 0.17, height);
		}

		for (let index = 0; index < 4; index += 1) {
			const foundation = box(
				[0.42, 0.48, SEWER_DEPTH - 0.24],
				[SEWER_MAX_X - 0.25, SEWER_FLOOR_Y + 0.3 + index * 0.76, SEWER_CENTER_Z],
				index % 2 === 0 ? 0x8d755d : 0x6f5b49
			);
			foundation.rotation.z = index % 2 === 0 ? 0.035 : -0.025;
			this.sewerRoot.add(foundation);
		}
		const villaSign = this.makePriceTag('VILLA →');
		villaSign.scale.set(2.25, 0.78, 1);
		villaSign.position.set(SEWER_MAX_X - 1.7, SEWER_FLOOR_Y + 2.75, SEWER_MAX_Z + 0.04);
		this.sewerRoot.add(villaSign);
		const villaGlow = new THREE.PointLight(0xffb260, 8, 11, 2);
		villaGlow.position.set(SEWER_MAX_X - 2.2, SEWER_FLOOR_Y + 2.3, SEWER_CENTER_Z + 0.2);
		this.sewerRoot.add(villaGlow);

		for (let x = TOILET_X + 4; x < SEWER_MAX_X - 5; x += 14) {
			const tunnelLight = new THREE.PointLight(0x799066, 3.4, 12, 2);
			tunnelLight.position.set(x, SEWER_FLOOR_Y + 2.9, SEWER_CENTER_Z + 0.25);
			this.sewerRoot.add(tunnelLight);
		}

		this.sewerLight.position.set(TOILET_X + 1.5, SEWER_FLOOR_Y + 2.6, SEWER_CENTER_Z + 0.4);
		this.sewerRoot.add(this.sewerLight);
	}

	private addSewerObstacle(x: number, y: number, width: number, height: number) {
		const obstacle = box([width, height, SEWER_DEPTH - 0.28], [x, y, SEWER_CENTER_Z], 0x59605a);
		this.sewerRoot.add(obstacle);
		this.bulletImpactSurfaces.push(obstacle);
		this.stampSurfaceKinds.set(obstacle, 'wall');
		this.sewerObstacles.push({
			minX: x - width / 2,
			maxX: x + width / 2,
			minY: y - height / 2,
			maxY: y + height / 2
		});
	}

	private makeBrokenDoorDetails(leafHeight: number, leafDepth: number, faceOffset: number) {
		const damage = new THREE.Group();
		const crackColor = 0x4b3127;
		const impactY = leafHeight * 0.43;
		const impactZ = leafDepth * 0.7;
		const crackBranches = [
			[0.4, -0.82],
			[0.5, -0.08],
			[0.42, 0.72]
		] as Array<[number, number]>;

		for (const face of [-1, 1]) {
			const impact = new THREE.Mesh(
				new THREE.CircleGeometry(0.105, 7),
				new THREE.MeshBasicMaterial({ color: crackColor, side: THREE.DoubleSide })
			);
			impact.position.set(face * (faceOffset + 0.003), impactY, impactZ);
			impact.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
			damage.add(impact);

			for (const [length, angle] of crackBranches) {
				const y = impactY + Math.cos(angle) * length * 0.48;
				const z = impactZ + Math.sin(angle) * length * 0.48;
				const scar = box([0.008, length, 0.025], [face * faceOffset, y, z], crackColor);
				scar.rotation.x = angle;
				scar.castShadow = false;
				damage.add(scar);
			}
		}

		damage.visible = false;
		return damage;
	}

	private createLeftRoomDoor(
		room: LeftRoomName,
		label: string,
		centerZ: number,
		accentColor: number
	) {
		const doorMinZ = centerZ - LEFT_ROOM_DOOR_WIDTH / 2;
		const doorMaxZ = centerZ + LEFT_ROOM_DOOR_WIDTH / 2;
		const frameX = -ROOM_WIDTH / 2 + 0.02;
		const frameColor = 0x332b27;
		this.scene.add(
			box(
				[0.22, LEFT_ROOM_DOOR_HEIGHT + 0.18, 0.16],
				[frameX, LEFT_ROOM_DOOR_HEIGHT / 2, doorMinZ],
				frameColor
			),
			box(
				[0.22, LEFT_ROOM_DOOR_HEIGHT + 0.18, 0.16],
				[frameX, LEFT_ROOM_DOOR_HEIGHT / 2, doorMaxZ],
				frameColor
			),
			box(
				[0.22, 0.18, LEFT_ROOM_DOOR_WIDTH + 0.16],
				[frameX, LEFT_ROOM_DOOR_HEIGHT, centerZ],
				frameColor
			)
		);

		const pivot = new THREE.Group();
		pivot.position.set(-ROOM_WIDTH / 2 + 0.105, 0, doorMinZ + 0.08);
		const leafDepth = LEFT_ROOM_DOOR_WIDTH - 0.16;
		const leafRoot = new THREE.Group();
		const leaf = box(
			[0.12, LEFT_ROOM_DOOR_HEIGHT - 0.12, leafDepth],
			[0, (LEFT_ROOM_DOOR_HEIGHT - 0.12) / 2, leafDepth / 2],
			0x8f593f
		);
		const marker = box([0.035, 0.44, 0.62], [0.068, 1.94, leafDepth / 2], accentColor);
		const handle = shadowMesh(new THREE.SphereGeometry(0.078, 12, 8), material(0xd2a74b, 0.36));
		handle.position.set(0.105, 1.25, leafDepth - 0.25);
		const damage = this.makeBrokenDoorDetails(LEFT_ROOM_DOOR_HEIGHT - 0.12, leafDepth, 0.071);
		leafRoot.add(leaf, marker, handle, damage);
		pivot.add(leafRoot);
		this.scene.add(pivot);

		const door: LeftRoomDoor = {
			room,
			label,
			centerZ,
			width: LEFT_ROOM_DOOR_WIDTH,
			height: LEFT_ROOM_DOOR_HEIGHT,
			pivot,
			leafRoot,
			damage,
			surfaces: [leaf],
			open: false,
			openAmount: 0
		};
		this.leftRoomDoors.push(door);
		this.setLeftRoomDoorCollisionEnabled(door, true);
	}

	private createKitchen() {
		const doorMinZ = DOOR_CENTER_Z - DOOR_WIDTH / 2;
		const doorMaxZ = DOOR_CENTER_Z + DOOR_WIDTH / 2;
		const backPanelDepth = doorMinZ + ROOM_DEPTH / 2;
		const frontPanelDepth = ROOM_DEPTH / 2 - doorMaxZ;
		const sharedWallPanels = [
			box(
				[0.18, ROOM_HEIGHT, backPanelDepth],
				[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2 + backPanelDepth / 2],
				COLORS.wall
			),
			box(
				[0.18, ROOM_HEIGHT, frontPanelDepth],
				[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, doorMaxZ + frontPanelDepth / 2],
				COLORS.wall
			),
			box(
				[0.18, ROOM_HEIGHT - DOOR_HEIGHT, DOOR_WIDTH],
				[ROOM_WIDTH / 2, DOOR_HEIGHT + (ROOM_HEIGHT - DOOR_HEIGHT) / 2, DOOR_CENTER_Z],
				COLORS.wall
			)
		];
		for (const panel of sharedWallPanels) {
			panel.receiveShadow = true;
			this.scene.add(panel);
			this.bulletImpactSurfaces.push(panel);
			this.stampSurfaceKinds.set(panel, 'wall');
		}

		const kitchenFloor = shadowMesh(
			new THREE.PlaneGeometry(KITCHEN_WIDTH, ROOM_DEPTH),
			material(0xd5c7ae, 0.94)
		);
		kitchenFloor.rotation.x = -Math.PI / 2;
		kitchenFloor.position.set(KITCHEN_CENTER_X, -0.004, 0);
		kitchenFloor.receiveShadow = true;
		this.scene.add(kitchenFloor);
		this.bulletImpactSurfaces.push(kitchenFloor);
		this.stampSurfaceKinds.set(kitchenFloor, 'floor');

		for (let x = KITCHEN_MIN_X + 0.7; x < KITCHEN_MAX_X; x += 0.7) {
			const seam = box([0.018, 0.008, ROOM_DEPTH - 0.2], [x, 0.018, 0], 0xb7a68b);
			seam.receiveShadow = false;
			this.scene.add(seam);
		}
		for (let z = BACK_WALL_Z + 0.7; z < ROOM_DEPTH / 2; z += 0.7) {
			const seam = box([KITCHEN_WIDTH - 0.2, 0.008, 0.018], [KITCHEN_CENTER_X, 0.019, z], 0xb7a68b);
			seam.receiveShadow = false;
			this.scene.add(seam);
		}

		const kitchenOuterWall = box(
			[0.18, ROOM_HEIGHT, ROOM_DEPTH],
			[KITCHEN_MAX_X, ROOM_HEIGHT / 2, 0],
			0xe0cbb1
		);
		const backDoorLeft = KITCHEN_BACK_DOOR_X - KITCHEN_BACK_DOOR_WIDTH / 2;
		const backDoorRight = KITCHEN_BACK_DOOR_X + KITCHEN_BACK_DOOR_WIDTH / 2;
		const kitchenBackWalls = [
			box(
				[backDoorLeft - KITCHEN_MIN_X, ROOM_HEIGHT, 0.18],
				[(KITCHEN_MIN_X + backDoorLeft) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z],
				0xe7d6bd
			),
			box(
				[KITCHEN_MAX_X - backDoorRight, ROOM_HEIGHT, 0.18],
				[(backDoorRight + KITCHEN_MAX_X) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z],
				0xe7d6bd
			),
			box(
				[KITCHEN_BACK_DOOR_WIDTH, ROOM_HEIGHT - KITCHEN_BACK_DOOR_HEIGHT, 0.18],
				[
					KITCHEN_BACK_DOOR_X,
					KITCHEN_BACK_DOOR_HEIGHT + (ROOM_HEIGHT - KITCHEN_BACK_DOOR_HEIGHT) / 2,
					BACK_WALL_Z
				],
				0xe7d6bd
			)
		];
		for (const wall of [kitchenOuterWall, ...kitchenBackWalls]) {
			wall.receiveShadow = true;
			this.scene.add(wall);
			this.bulletImpactSurfaces.push(wall);
			this.stampSurfaceKinds.set(wall, 'wall');
		}
		this.createLockedKitchenBackDoor();

		const cabinetColor = 0x78966f;
		for (const x of [8.15, 9.45, 10.75]) {
			const lower = box([1.18, 0.86, 0.68], [x, 0.43, BACK_WALL_Z + 0.43], cabinetColor);
			const upper = box([1.18, 0.86, 0.48], [x, 2.45, BACK_WALL_Z + 0.34], 0x91aa86);
			this.scene.add(lower, upper);
		}
		const counter = box([4.05, 0.14, 0.84], [9.45, 0.93, BACK_WALL_Z + 0.48], 0x4a403a);
		this.scene.add(counter);
		const sink = box([0.78, 0.045, 0.46], [9.45, 1.015, BACK_WALL_Z + 0.51], 0xa9aaa3);
		const tap = cylinder(0.035, 0.035, 0.5, [9.45, 1.23, BACK_WALL_Z + 0.25], 0x6f7373, 10);
		tap.rotation.x = Math.PI / 2;
		this.scene.add(sink, tap);

		const frameColor = 0x332b27;
		this.scene.add(
			box(
				[0.22, DOOR_HEIGHT + 0.18, 0.18],
				[ROOM_WIDTH / 2 - 0.02, DOOR_HEIGHT / 2, doorMinZ],
				frameColor
			),
			box(
				[0.22, DOOR_HEIGHT + 0.18, 0.18],
				[ROOM_WIDTH / 2 - 0.02, DOOR_HEIGHT / 2, doorMaxZ],
				frameColor
			),
			box(
				[0.22, 0.18, DOOR_WIDTH + 0.18],
				[ROOM_WIDTH / 2 - 0.02, DOOR_HEIGHT, DOOR_CENTER_Z],
				frameColor
			)
		);

		this.doorPivot = new THREE.Group();
		this.doorPivot.position.set(ROOM_WIDTH / 2 - 0.105, 0, doorMinZ + 0.09);
		const leafDepth = DOOR_WIDTH - 0.18;
		this.doorLeafRoot = new THREE.Group();
		const doorLeaf = box(
			[0.12, DOOR_HEIGHT - 0.12, leafDepth],
			[0, (DOOR_HEIGHT - 0.12) / 2, leafDepth / 2],
			0x9c5e3f
		);
		const doorWindow = box([0.035, 0.58, 0.78], [-0.068, 2.18, leafDepth / 2], 0x7eafbd);
		const handle = shadowMesh(new THREE.SphereGeometry(0.085, 12, 8), material(0xd2a74b, 0.36));
		handle.position.set(-0.105, 1.34, leafDepth - 0.27);
		this.doorDamage = this.makeBrokenDoorDetails(DOOR_HEIGHT - 0.12, leafDepth, 0.071);
		this.doorLeafRoot.add(doorLeaf, doorWindow, handle, this.doorDamage);
		this.doorPivot.add(this.doorLeafRoot);
		this.scene.add(this.doorPivot);
		this.doorStampSurfaces = [doorLeaf];
		this.setDoorCollisionEnabled(true);
	}

	private createLockedKitchenBackDoor() {
		const frameZ = BACK_WALL_Z + 0.105;
		const frameColor = 0x302c2a;
		this.scene.add(
			box(
				[0.18, KITCHEN_BACK_DOOR_HEIGHT + 0.22, 0.18],
				[KITCHEN_BACK_DOOR_X - KITCHEN_BACK_DOOR_WIDTH / 2, KITCHEN_BACK_DOOR_HEIGHT / 2, frameZ],
				frameColor
			),
			box(
				[0.18, KITCHEN_BACK_DOOR_HEIGHT + 0.22, 0.18],
				[KITCHEN_BACK_DOOR_X + KITCHEN_BACK_DOOR_WIDTH / 2, KITCHEN_BACK_DOOR_HEIGHT / 2, frameZ],
				frameColor
			),
			box(
				[KITCHEN_BACK_DOOR_WIDTH + 0.18, 0.18, 0.18],
				[KITCHEN_BACK_DOOR_X, KITCHEN_BACK_DOOR_HEIGHT, frameZ],
				frameColor
			)
		);

		this.lockedBackDoorLeafRoot = new THREE.Group();
		this.lockedBackDoorLeafRoot.position.set(KITCHEN_BACK_DOOR_X, 0, BACK_WALL_Z + 0.12);
		const leaf = box(
			[KITCHEN_BACK_DOOR_WIDTH - 0.16, KITCHEN_BACK_DOOR_HEIGHT - 0.12, 0.14],
			[0, (KITCHEN_BACK_DOOR_HEIGHT - 0.12) / 2, 0.075],
			0x70452f
		);
		this.lockedBackDoorLeafRoot.add(leaf);
		this.bulletImpactSurfaces.push(leaf);
		const lockwork = new THREE.Group();
		this.lockedBackDoorLeafRoot.add(lockwork);

		for (let plank = -2; plank <= 2; plank += 1) {
			lockwork.add(
				box(
					[0.026, KITCHEN_BACK_DOOR_HEIGHT - 0.22, 0.026],
					[plank * 0.285, KITCHEN_BACK_DOOR_HEIGHT / 2, 0.158],
					plank % 2 === 0 ? 0x4b2e24 : 0x936042
				)
			);
		}

		const iron = 0x353b3c;
		for (const [y, angle] of [
			[0.78, -0.08],
			[1.42, 0.06],
			[2.08, -0.055]
		] as Array<[number, number]>) {
			const bar = box([KITCHEN_BACK_DOOR_WIDTH + 0.34, 0.15, 0.15], [0, y, 0.23], iron);
			bar.rotation.z = angle;
			lockwork.add(bar);
			for (const x of [-KITCHEN_BACK_DOOR_WIDTH / 2 - 0.08, KITCHEN_BACK_DOOR_WIDTH / 2 + 0.08]) {
				const bolt = shadowMesh(
					new THREE.SphereGeometry(0.07, 8, 6),
					material(0x77766d, 0.5, 0.65)
				);
				bolt.position.set(x, y + x * Math.sin(angle), 0.32);
				bolt.scale.z = 0.55;
				lockwork.add(bolt);
			}
		}

		for (const direction of [-1, 1]) {
			for (let index = 0; index < 7; index += 1) {
				const progress = index / 6;
				const link = shadowMesh(
					new THREE.TorusGeometry(0.105, 0.035, 7, 12),
					material(0x4b5251, 0.42, 0.72)
				);
				link.position.set(
					direction * THREE.MathUtils.lerp(-0.58, 0.58, progress),
					THREE.MathUtils.lerp(0.48, 2.38, progress),
					0.335 + (index % 2) * 0.012
				);
				link.scale.y = 1.28;
				link.rotation.z = direction * -0.55 + (index % 2) * 0.32;
				lockwork.add(link);
			}
		}

		for (const [x, y, color] of [
			[-0.4, 1.02, 0xb9852f],
			[0.42, 1.46, 0x9a6e29],
			[0, 1.86, 0xc0963e]
		] as Array<[number, number, number]>) {
			const shackle = shadowMesh(
				new THREE.TorusGeometry(0.125, 0.038, 8, 14),
				material(0x5d6260, 0.4, 0.78)
			);
			shackle.position.set(x, y + 0.12, 0.38);
			shackle.scale.y = 1.2;
			const lockBody = box([0.28, 0.25, 0.13], [x, y, 0.39], color);
			lockwork.add(shackle, lockBody);
		}
		const exteriorLockwork = lockwork.clone(true);
		exteriorLockwork.scale.z = -1;
		this.lockedBackDoorLeafRoot.add(exteriorLockwork);

		this.scene.add(this.lockedBackDoorLeafRoot);
	}

	private createGarden() {
		const gardenCenterZ = BACK_WALL_Z - GARDEN_DEPTH / 2;
		const lawn = shadowMesh(
			new THREE.PlaneGeometry(GARDEN_WIDTH, GARDEN_DEPTH),
			material(0x789b55, 0.96)
		);
		lawn.rotation.x = -Math.PI / 2;
		lawn.position.set(0, -0.006, gardenCenterZ);
		lawn.receiveShadow = true;
		this.scene.add(lawn);
		this.bulletImpactSurfaces.push(lawn);
		this.stampSurfaceKinds.set(lawn, 'floor');

		const patio = shadowMesh(new THREE.CircleGeometry(3.4, 36), material(0xc9b89c, 0.94));
		patio.scale.z = 0.72;
		patio.rotation.x = -Math.PI / 2;
		patio.position.set(-1.8, 0.012, -10.1);
		patio.receiveShadow = true;
		this.scene.add(patio);

		for (let index = 0; index < 7; index += 1) {
			const stone = cylinder(
				0.42 + (index % 2) * 0.08,
				0.46 + (index % 2) * 0.08,
				0.055,
				[WINDOW_CENTER_X + Math.sin(index * 0.9) * 0.34, 0.022, BACK_WALL_Z - 1.1 - index * 0.72],
				index % 2 ? 0xd7c7aa : 0xbda98d,
				12
			);
			stone.rotation.y = index * 0.63;
			stone.receiveShadow = true;
			this.scene.add(stone);
		}

		const hedgeMaterial = material(0x4f753f, 0.98);
		const leftHedge = shadowMesh(
			new THREE.BoxGeometry(0.55, 2.65, GARDEN_DEPTH),
			hedgeMaterial.clone()
		);
		leftHedge.position.set(-GARDEN_WIDTH / 2, 1.3, gardenCenterZ);
		const rightHedge = leftHedge.clone();
		rightHedge.material = hedgeMaterial.clone();
		rightHedge.position.x = GARDEN_WIDTH / 2;
		const backHedge = shadowMesh(
			new THREE.BoxGeometry(GARDEN_WIDTH, 2.65, 0.55),
			hedgeMaterial.clone()
		);
		backHedge.position.set(0, 1.3, GARDEN_BACK_Z);
		for (const hedge of [leftHedge, rightHedge, backHedge]) {
			this.scene.add(hedge);
			this.bulletImpactSurfaces.push(hedge);
			this.stampSurfaceKinds.set(hedge, 'wall');
		}

		for (let x = -9; x <= 9; x += 3) {
			const shrub = shadowMesh(new THREE.DodecahedronGeometry(0.75, 1), material(0x648a49, 0.95));
			shrub.scale.set(1.3, 1, 0.75);
			shrub.position.set(x, 0.65, GARDEN_BACK_Z + 0.55);
			this.scene.add(shrub);
		}

		const exteriorTrim = box(
			[ROOM_WIDTH - 0.2, 0.22, 0.16],
			[0, 0.11, BACK_WALL_Z - 0.1],
			0xbca88b
		);
		this.scene.add(exteriorTrim);
	}

	private async loadRabbit() {
		const [rabbitGltf, pistolGltf] = await Promise.all([
			this.loader.loadAsync('/models/konijn-v18.glb'),
			this.loader.loadAsync('/models/low-poly-g17.glb')
		]);
		const model = rabbitGltf.scene;
		model.updateMatrixWorld(true);
		const initialBox = new THREE.Box3().setFromObject(model);
		const size = initialBox.getSize(new THREE.Vector3());
		const scale = PLAYER_HEIGHT / Math.max(size.y, 0.001);
		model.scale.setScalar(scale);
		model.updateMatrixWorld(true);
		const scaledBox = new THREE.Box3().setFromObject(model);
		const center = scaledBox.getCenter(new THREE.Vector3());
		model.position.set(-center.x, -scaledBox.min.y, -center.z);
		model.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			child.castShadow = true;
			child.receiveShadow = true;
		});
		this.attachPistol(model, pistolGltf.scene);
		this.setupArmRagdolls(model);

		this.rabbitSquash.add(model);
		this.rabbitSquash.position.y = -PLAYER_HEIGHT / 2;
		this.rabbitTumble.position.y = PLAYER_HEIGHT / 2;
		this.rabbitTumble.add(this.rabbitSquash);
		this.player.add(this.rabbitTumble);
		this.player.position.set(0, 0, 2.4);
		this.scene.add(this.player);
	}

	private setupArmRagdolls(model: THREE.Group) {
		const leftArm = model.getObjectByName('left_arm');
		const rightArm = model.getObjectByName('right_arm');
		this.armRagdolls = [];
		if (leftArm) {
			this.armRagdolls.push({
				object: leftArm,
				baseQuaternion: leftArm.quaternion.clone(),
				direction: -1,
				angle: 0,
				angularVelocity: 0
			});
		}
		if (rightArm) {
			this.armRagdolls.push({
				object: rightArm,
				baseQuaternion: rightArm.quaternion.clone(),
				direction: 1,
				angle: 0,
				angularVelocity: 0
			});
		}
	}

	private attachPistol(model: THREE.Group, pistolModel: THREE.Group) {
		const rightArm = model.getObjectByName('right_arm');
		if (!rightArm) return;

		const pivot = new THREE.Group();
		pivot.name = 'held_pistol_grip';
		pivot.position.set(-0.018, -0.088, 0.082);
		pivot.rotation.set(0.18, -0.16, 0.2);

		const gun = new THREE.Group();
		gun.name = 'pistol';
		pistolModel.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			child.castShadow = true;
			child.receiveShadow = true;
		});
		gun.add(pistolModel);

		let muzzle = gun.getObjectByName('pistol_muzzle');
		if (!muzzle) {
			muzzle = new THREE.Object3D();
			muzzle.name = 'pistol_muzzle';
			muzzle.position.set(0, 0.014, 0.205);
			gun.add(muzzle);
		}
		pivot.add(gun);
		rightArm.add(pivot);

		this.pistolPivot = pivot;
		this.pistolMuzzle = muzzle;
		this.syncWeaponModel();
	}

	private syncWeaponModel() {
		if (this.pistolPivot) this.pistolPivot.visible = this.weapon === 'pistol';
	}

	private createBreakables() {
		this.addBreakable(
			'VAAS',
			20,
			this.makeVase(COLORS.blue),
			[-4.2, 0, -2.5],
			0.48,
			1.05,
			'ceramic'
		);
		this.addBreakable(
			'DIKKE VAAS',
			35,
			this.makeVase(COLORS.pink),
			[4.7, 0, -1.4],
			0.54,
			1.15,
			'ceramic'
		);
		this.addBreakable('LAMP', 45, this.makeLamp(), [5.7, 0, 2.2], 0.6, 2.25, 'metal');
		this.addBreakable(
			'STOEL',
			35,
			this.makeChair(COLORS.yellow),
			[-3.5, 0, 1.2],
			0.85,
			1.45,
			'wood'
		);
		this.addBreakable('TAFEL', 60, this.makeTable(), [2.7, 0, 0.2], 1.0, 1.05, 'wood');
		this.addBreakable('MONSTERA', 30, this.makePlant(), [-5.5, 0, 2.5], 0.7, 1.8, 'plant');
		this.addBreakable(
			'TELEVISIE',
			250,
			this.makeTelevision(),
			[4.1, 0, -3.75],
			1.1,
			1.65,
			'electronics'
		);
		this.addBreakable('BOEKENKAST', 120, this.makeShelf(), [-5.6, 0, -3.65], 1.0, 2.1, 'wood');
		this.addBreakable(
			'KONIJN #30',
			240,
			this.makeArtwork('/images/artwork/30.webp'),
			[-1.7, 1.8, -4.67],
			0.95,
			1.55,
			'canvas'
		);
		this.addBreakable(
			'KONIJN #28',
			180,
			this.makeArtwork('/images/artwork/28.webp'),
			[1.25, 1.65, -4.67],
			0.85,
			1.4,
			'canvas'
		);
		this.addBreakable(
			'FRUITSCHAAL',
			20,
			this.makeFruitBowl(),
			[2.7, 1.08, 0.2],
			0.55,
			0.45,
			'ceramic'
		);
		this.addBreakable('KRUKJE', 25, this.makeStool(), [0.15, 0, -2.8], 0.62, 0.82, 'wood');
		const fridge = this.makeFridge();
		fridge.rotation.y = -Math.PI / 2;
		this.addBreakable('KOELKAST', 420, fridge, [13.25, 0, -0.9], 0.76, 2.38, 'metal');
		this.addBreakable(
			'KEUKENEILAND',
			180,
			this.makeKitchenIsland(),
			[10.55, 0, -0.45],
			1.28,
			1.05,
			'wood'
		);
		this.kitchenHatchBreakable = this.addBreakable(
			'KELDERLUIK',
			90,
			this.makeKitchenHatch(),
			[KITCHEN_HATCH_X, 0.025, KITCHEN_HATCH_Z],
			1,
			0.16,
			'wood',
			2
		);
		this.toiletBreakable = this.addBreakable(
			'TOILET',
			280,
			this.makeToilet(),
			[TOILET_X, 0, TOILET_Z],
			0.62,
			1.12,
			'ceramic'
		);
		this.addBreakable('BED', 240, this.makeBed(), [-10.25, 0, 3.3], 1.35, 0.86, 'wood');
		this.upstairsBreakables.push(this.addBreakable(
			'KO-9 COMMAND DESK',
			780,
			this.makeKo9HackerDesk(),
			[0.25, UPSTAIRS_FLOOR_Y, -1.45],
			2.55,
			2.45,
			'electronics',
			2
		));
		this.upstairsBreakables.push(this.addBreakable(
			'GEHEIM ARCHIEF',
			360,
			this.makeKo9Archive(),
			[-10.05, UPSTAIRS_FLOOR_Y, -4.18],
			1.5,
			2.52,
			'metal',
			2
		));
		this.upstairsBreakables.push(this.addBreakable(
			'WAPENREK',
			620,
			this.makeKo9GunRack(),
			[7.65, UPSTAIRS_FLOOR_Y, -4.72],
			1.82,
			2.35,
			'metal',
			2
		));
		this.upstairsBreakables.push(this.addBreakable(
			'KO-9 KLUIS',
			1200,
			this.makeKo9Safe(),
			[12.15, UPSTAIRS_FLOOR_Y, -4.08],
			1.05,
			2.02,
			'metal',
			3
		));
		this.addBreakable(
			'ANTIEKE SPIEGEL',
			360,
			this.makeAntiqueMirror(),
			[-3.8, BASEMENT_FLOOR_Y, -4.48],
			0.95,
			2.55,
			'canvas',
			1,
			'basement'
		);
		this.addBreakable(
			'CHESTERFIELD',
			420,
			this.makeChesterfield(),
			[2.1, BASEMENT_FLOOR_Y, -3.55],
			1.65,
			1.25,
			'wood',
			1,
			'basement'
		);
		this.addBreakable(
			'OUDE KOFFER',
			75,
			this.makeOldTrunk(),
			[6.15, BASEMENT_FLOOR_Y, 3.45],
			0.82,
			0.72,
			'wood',
			1,
			'basement'
		);
		this.addBreakable(
			'GRAMMOFOON',
			130,
			this.makeGramophone(),
			[-1.25, BASEMENT_FLOOR_Y, 3.55],
			0.66,
			1.5,
			'metal',
			1,
			'basement'
		);

		this.addBreakable('BBQ', 180, this.makeBarbecue(), [-1.7, 0, -10.1], 0.82, 1.45, 'metal');
		this.addBreakable('HONDENHOK', 140, this.makeDoghouse(), [4.15, 0, -8.45], 1.12, 1.72, 'wood');
		const leftGardenChair = this.makeGardenChair(COLORS.orange);
		leftGardenChair.rotation.y = 0.42;
		this.addBreakable('TUINSTOEL', 45, leftGardenChair, [-4.2, 0, -9.4], 0.82, 1.15, 'wood');
		const rightGardenChair = this.makeGardenChair(COLORS.blue);
		rightGardenChair.rotation.y = -0.55;
		this.addBreakable('TUINSTOEL', 45, rightGardenChair, [0.8, 0, -11.2], 0.82, 1.15, 'wood');
		this.addBreakable('ZWEMBAD', 320, this.makePool(), [5.2, 0, -15.1], 2.2, 0.82, 'canvas');
		this.addBreakable(
			'APPELBOOM',
			480,
			this.makeAppleTree(),
			[-5.4, 0, -16.1],
			1.45,
			4.25,
			'plant',
			3
		);
	}

	private addBreakable(
		label: string,
		value: number,
		group: THREE.Group,
		position: [number, number, number],
		radius: number,
		height: number,
		breakMaterial: BreakMaterial,
		stampsRequired = 1,
		biome: BiomeName = 'ground'
	) {
		group.position.set(...position);
		group.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			child.castShadow = true;
			child.receiveShadow = true;
		});
		const color = this.firstMaterialColor(group) ?? new THREE.Color(COLORS.orange);
		const price = this.makePriceTag(`€${value}`);
		price.position.set(0, height + 0.24, 0);
		group.add(price);
		this.breakablesRoot.add(group);
		const breakable: Breakable = {
			group,
			label,
			value,
			radius,
			height,
			color,
			material: breakMaterial,
			broken: false,
			stampCount: 0,
			stampsRequired,
			lastStampSequence: -1,
			basePosition: group.position.clone(),
			baseQuaternion: group.quaternion.clone(),
			tiltAxis: new THREE.Vector3(),
			biome
		};
		this.breakables.push(breakable);
		return breakable;
	}

	private makeVase(color: number) {
		const group = new THREE.Group();
		const points = [
			new THREE.Vector2(0.18, 0),
			new THREE.Vector2(0.36, 0.12),
			new THREE.Vector2(0.43, 0.5),
			new THREE.Vector2(0.3, 0.86),
			new THREE.Vector2(0.22, 0.96),
			new THREE.Vector2(0.22, 1.05)
		];
		group.add(shadowMesh(new THREE.LatheGeometry(points, 28), material(color, 0.42)));
		return group;
	}

	private makeLamp() {
		const group = new THREE.Group();
		group.add(cylinder(0.42, 0.5, 0.16, [0, 0.08, 0], COLORS.ink));
		group.add(cylinder(0.07, 0.07, 1.58, [0, 0.92, 0], COLORS.ink, 12));
		const shade = shadowMesh(
			new THREE.ConeGeometry(0.58, 0.72, 24, 1, true),
			material(COLORS.orange)
		);
		shade.position.y = 1.85;
		group.add(shade);
		return group;
	}

	private makeChair(color: number) {
		const group = new THREE.Group();
		group.add(box([1.05, 0.18, 0.95], [0, 0.78, 0], color));
		group.add(box([1.05, 0.78, 0.16], [0, 1.22, -0.4], color));
		for (const x of [-0.42, 0.42]) {
			for (const z of [-0.34, 0.34]) group.add(box([0.13, 0.78, 0.13], [x, 0.39, z], COLORS.ink));
		}
		return group;
	}

	private makeTable() {
		const group = new THREE.Group();
		group.add(cylinder(0.94, 0.94, 0.18, [0, 0.98, 0], 0x75503e, 32));
		group.add(cylinder(0.18, 0.28, 0.92, [0, 0.46, 0], COLORS.ink, 16));
		group.add(cylinder(0.58, 0.68, 0.12, [0, 0.06, 0], COLORS.ink, 24));
		return group;
	}

	private makePlant() {
		const group = new THREE.Group();
		group.add(cylinder(0.38, 0.48, 0.58, [0, 0.29, 0], 0xb85f42));
		group.add(cylinder(0.04, 0.04, 1.15, [0, 1.02, 0], 0x456743, 10));
		for (let index = 0; index < 7; index += 1) {
			const leaf = shadowMesh(new THREE.SphereGeometry(0.28, 12, 8), material(COLORS.green));
			const angle = (index / 7) * Math.PI * 2;
			leaf.scale.set(1.45, 0.34, 0.72);
			leaf.rotation.y = angle;
			leaf.rotation.z = (index % 2 ? 1 : -1) * 0.45;
			leaf.position.set(Math.cos(angle) * 0.36, 1.18 + (index % 3) * 0.2, Math.sin(angle) * 0.36);
			group.add(leaf);
		}
		return group;
	}

	private makeTelevision() {
		const group = new THREE.Group();
		group.add(box([1.85, 1.15, 0.28], [0, 1.18, 0], COLORS.ink));
		group.add(box([1.58, 0.88, 0.06], [0, 1.2, 0.17], 0x83b7c7));
		group.add(box([0.16, 0.65, 0.16], [0, 0.48, 0], COLORS.ink));
		group.add(box([1.1, 0.14, 0.58], [0, 0.1, 0], COLORS.ink));
		return group;
	}

	private makeKo9WallPanel(
		width: number,
		height: number,
		variant: 'brand' | 'targets' | 'network' | 'restricted'
	) {
		const group = new THREE.Group();
		group.add(box([width, height, 0.08], [0, 0, 0], 0x111513));
		const canvas = document.createElement('canvas');
		canvas.width = 1024;
		canvas.height = Math.max(256, Math.round((height / width) * canvas.width));
		const context = canvas.getContext('2d');
		if (context) {
			const w = canvas.width;
			const h = canvas.height;
			context.fillStyle = '#171d1a';
			context.fillRect(0, 0, w, h);
			context.strokeStyle = 'rgba(96, 133, 116, 0.16)';
			context.lineWidth = 2;
			for (let x = 0; x < w; x += 48) {
				context.beginPath();
				context.moveTo(x, 0);
				context.lineTo(x, h);
				context.stroke();
			}
			for (let y = 0; y < h; y += 48) {
				context.beginPath();
				context.moveTo(0, y);
				context.lineTo(w, y);
				context.stroke();
			}

			if (variant === 'brand') {
				context.fillStyle = '#e87832';
				context.fillRect(0, 0, 34, h);
				context.fillStyle = '#f1ead7';
				context.font = `900 ${Math.round(h * 0.5)}px system-ui, sans-serif`;
				context.textBaseline = 'middle';
				context.fillText('KO-9', 76, h * 0.51);
				context.fillStyle = '#77d2bd';
				context.font = `800 ${Math.round(h * 0.16)}px system-ui, sans-serif`;
				context.fillText('// COVERT OPERATIONS', w * 0.48, h * 0.52);
			} else if (variant === 'restricted') {
				context.strokeStyle = '#dc5c45';
				context.lineWidth = 12;
				context.strokeRect(18, 18, w - 36, h - 36);
				context.fillStyle = '#dc5c45';
				context.font = `900 ${Math.round(h * 0.25)}px system-ui, sans-serif`;
				context.textAlign = 'center';
				context.fillText('KO-9 ONLY', w / 2, h * 0.45);
				context.fillStyle = '#eee5d1';
				context.font = `800 ${Math.round(h * 0.12)}px system-ui, sans-serif`;
				context.fillText('GEHEIM  //  STAMP CLEARANCE', w / 2, h * 0.69);
			} else if (variant === 'targets') {
				context.fillStyle = '#e87832';
				context.fillRect(0, 0, w, Math.round(h * 0.18));
				context.fillStyle = '#171d1a';
				context.font = `900 ${Math.round(h * 0.09)}px system-ui, sans-serif`;
				context.fillText('TARGET LIST // PRIORITEIT', 38, h * 0.115);
				const names = ['DE VOSSENBAAS', 'M. HAVIK', 'DE MOL', 'PROF. KRAAI'];
				for (let index = 0; index < names.length; index += 1) {
					const y = h * (0.27 + index * 0.17);
					context.fillStyle = index === 0 ? '#dc5c45' : '#32413a';
					context.fillRect(35, y - h * 0.055, h * 0.11, h * 0.11);
					context.fillStyle = '#efe5d0';
					context.font = `800 ${Math.round(h * 0.052)}px system-ui, sans-serif`;
					context.fillText(`${String(index + 1).padStart(2, '0')}  ${names[index]}`, h * 0.18, y);
					context.fillStyle = index < 2 ? '#e87832' : '#76aa99';
					context.fillRect(w * 0.73, y - 7, w * (0.18 - index * 0.025), 14);
				}
			} else {
				context.fillStyle = '#77d2bd';
				context.font = `900 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
				context.fillText('CRIMINAL CONNECTION BOARD', 34, h * 0.1);
				const nodes = [
					{ x: 0.18, y: 0.34, name: 'VOS' },
					{ x: 0.5, y: 0.25, name: 'HAVIK' },
					{ x: 0.78, y: 0.39, name: 'KRAAI' },
					{ x: 0.35, y: 0.72, name: 'MOL' },
					{ x: 0.68, y: 0.73, name: '???' }
				];
				context.lineWidth = 8;
				for (const [from, to] of [
					[0, 1],
					[1, 2],
					[0, 3],
					[3, 4],
					[2, 4],
					[1, 4]
				] as Array<[number, number]>) {
					context.strokeStyle = (from + to) % 2 === 0 ? '#dc5c45' : '#e5a34f';
					context.beginPath();
					context.moveTo(nodes[from].x * w, nodes[from].y * h);
					context.lineTo(nodes[to].x * w, nodes[to].y * h);
					context.stroke();
				}
				for (let index = 0; index < nodes.length; index += 1) {
					const node = nodes[index];
					const cardW = w * 0.14;
					const cardH = h * 0.18;
					context.fillStyle = index === 4 ? '#49362f' : '#d8cfb9';
					context.fillRect(node.x * w - cardW / 2, node.y * h - cardH / 2, cardW, cardH);
					context.fillStyle = '#222824';
					context.beginPath();
					context.arc(node.x * w, node.y * h - cardH * 0.08, cardH * 0.18, 0, Math.PI * 2);
					context.fill();
					context.fillStyle = '#171d1a';
					context.font = `900 ${Math.round(h * 0.035)}px system-ui, sans-serif`;
					context.textAlign = 'center';
					context.fillText(node.name, node.x * w, node.y * h + cardH * 0.34);
				}
			}
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const face = new THREE.Mesh(
			new THREE.PlaneGeometry(width - 0.1, height - 0.1),
			new THREE.MeshBasicMaterial({ map: texture })
		);
		face.position.z = 0.045;
		group.add(face);
		return group;
	}

	private makeKo9HackerDesk() {
		const group = new THREE.Group();
		const darkMetal = 0x171d1a;
		group.add(box([4.75, 0.18, 1.35], [0, 0.88, 0], 0x28312c));
		for (const x of [-2.1, 2.1]) {
			group.add(box([0.16, 0.86, 1.05], [x, 0.43, 0], darkMetal));
		}
		for (let index = 0; index < 3; index += 1) {
			const monitor = new THREE.Group();
			monitor.add(box([1.36, 0.88, 0.13], [0, 0, 0], 0x101412));
			monitor.add(this.makeKo9MonitorFace(1.2, 0.72, index));
			monitor.add(box([0.08, 0.45, 0.08], [0, -0.62, -0.02], darkMetal));
			monitor.add(box([0.58, 0.06, 0.42], [0, -0.84, 0], darkMetal));
			monitor.position.set(-1.48 + index * 1.48, 1.68, -0.28);
			monitor.rotation.y = (1 - index) * 0.14;
			group.add(monitor);
		}
		group.add(box([1.32, 0.055, 0.43], [0, 1.01, 0.39], 0x111613));
		for (let row = 0; row < 3; row += 1) {
			for (let key = 0; key < 10; key += 1) {
				group.add(
					box(
						[0.085, 0.018, 0.065],
						[-0.43 + key * 0.095, 1.045, 0.28 + row * 0.085],
						(row + key) % 7 === 0 ? 0xe87832 : 0x6b8276
					)
				);
			}
		}
		for (const x of [-1.82, 1.82]) {
			group.add(box([0.48, 0.74, 0.82], [x, 0.38, -0.04], 0x121815));
			for (let light = 0; light < 3; light += 1) {
				group.add(box([0.045, 0.045, 0.02], [x - 0.12 + light * 0.12, 0.58, 0.38], 0x58c8b5));
			}
		}
		return group;
	}

	private makeKo9MonitorFace(width: number, height: number, index: number) {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 320;
		const context = canvas.getContext('2d');
		if (context) {
			context.fillStyle = '#07110d';
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.fillStyle = index === 1 ? '#ef8b3b' : '#61d6b8';
			context.font = '900 28px monospace';
			context.fillText(index === 1 ? 'KO-9 // LIVE OPS' : 'ROOT@KO-9:~$', 22, 40);
			context.font = '700 18px monospace';
			for (let line = 0; line < 9; line += 1) {
				const offset = (line * 43 + index * 71) % 250;
				context.globalAlpha = 0.45 + (line % 3) * 0.18;
				context.fillRect(24, 66 + line * 25, 120 + offset, 8);
			}
			context.globalAlpha = 1;
			context.strokeStyle = '#345c4f';
			context.lineWidth = 2;
			context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const face = new THREE.Mesh(
			new THREE.PlaneGeometry(width, height),
			new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
		);
		face.position.z = 0.071;
		return face;
	}

	private makeKo9Archive() {
		const group = new THREE.Group();
		for (let cabinet = 0; cabinet < 3; cabinet += 1) {
			const x = -0.88 + cabinet * 0.88;
			group.add(box([0.8, 2.35, 0.62], [x, 1.175, 0], 0x3f4a43));
			for (let drawer = 0; drawer < 4; drawer += 1) {
				const y = 0.36 + drawer * 0.55;
				group.add(box([0.67, 0.44, 0.035], [x, y, 0.33], 0x556158));
				group.add(box([0.24, 0.055, 0.035], [x, y, 0.36], 0x171d1a));
				group.add(box([0.25, 0.11, 0.018], [x, y + 0.11, 0.37], 0xd8cfae));
			}
		}
		group.add(box([2.8, 0.11, 0.78], [0, 2.4, 0], 0x171d1a));
		return group;
	}

	private makeKo9GunRack() {
		const group = new THREE.Group();
		group.add(box([3.25, 2.2, 0.18], [0, 1.1, 0], 0x232925));
		for (const x of [-1.38, 1.38]) {
			group.add(box([0.11, 2.05, 0.2], [x, 1.1, 0.12], 0x111513));
		}
		for (let index = 0; index < 3; index += 1) {
			const weapon = new THREE.Group();
			weapon.add(box([1.75, 0.1, 0.11], [0.25, 0, 0.18], 0x121614));
			weapon.add(box([0.8, 0.22, 0.18], [-0.52, -0.04, 0.18], 0x343d37));
			weapon.add(box([0.42, 0.32, 0.18], [-1.02, -0.05, 0.18], 0x503d2d));
			const grip = box([0.18, 0.42, 0.16], [-0.25, -0.25, 0.18], 0x1a201d);
			grip.rotation.z = -0.22;
			weapon.add(grip);
			weapon.position.set(0, 1.7 - index * 0.66, 0);
			weapon.rotation.z = index % 2 === 0 ? -0.07 : 0.08;
			group.add(weapon);
		}
		group.add(box([2.9, 0.09, 0.22], [0, 0.18, 0.18], 0xe87832));
		return group;
	}

	private makeKo9Safe() {
		const group = new THREE.Group();
		group.add(box([1.72, 1.85, 1.18], [0, 0.925, 0], 0x272e2a));
		group.add(box([1.48, 1.6, 0.12], [0, 0.98, 0.65], 0x3f4a43));
		const wheel = cylinder(0.29, 0.29, 0.12, [0, 1.08, 0.76], 0x151a17, 18);
		wheel.rotation.x = Math.PI / 2;
		group.add(wheel);
		for (let index = 0; index < 4; index += 1) {
			const spoke = box([0.055, 0.72, 0.055], [0, 1.08, 0.84], 0xaab1a7);
			spoke.rotation.z = (index * Math.PI) / 4;
			group.add(spoke);
		}
		group.add(box([0.34, 0.46, 0.07], [0.48, 1.34, 0.75], 0x101512));
		for (let row = 0; row < 3; row += 1) {
			for (let column = 0; column < 3; column += 1) {
				group.add(
					box(
						[0.055, 0.055, 0.02],
						[0.39 + column * 0.09, 1.22 + row * 0.1, 0.795],
						(row + column) % 2 === 0 ? 0xe87832 : 0x76b6a4
					)
				);
			}
		}
		return group;
	}

	private makeShelf() {
		const group = new THREE.Group();
		group.add(box([1.7, 2.1, 0.38], [0, 1.05, 0], 0x6b4939));
		for (let row = 0; row < 3; row += 1) {
			group.add(box([1.48, 0.08, 0.48], [0, 0.42 + row * 0.58, 0.14], COLORS.cream));
			for (let book = 0; book < 5; book += 1) {
				const color = [COLORS.orange, COLORS.blue, COLORS.pink, COLORS.green, COLORS.yellow][
					(row + book) % 5
				];
				group.add(box([0.18, 0.38, 0.3], [-0.52 + book * 0.26, 0.64 + row * 0.58, 0.18], color));
			}
		}
		return group;
	}

	private makeAntiqueMirror() {
		const group = new THREE.Group();
		const frameColor = 0x5b3827;
		group.add(box([1.45, 2.48, 0.16], [0, 1.24, 0], frameColor));
		const glass = shadowMesh(
			new THREE.BoxGeometry(1.12, 2.04, 0.035),
			material(0x9aadb0, 0.18, 0.42)
		);
		glass.position.set(0, 1.27, 0.1);
		group.add(glass);
		for (const y of [0.14, 2.39]) {
			group.add(cylinder(0.17, 0.11, 1.62, [0, y, 0.02], 0x6e432c, 12));
		}
		for (const x of [-0.69, 0.69]) {
			group.add(cylinder(0.12, 0.12, 2.24, [x, 1.24, 0.02], 0x6e432c, 12));
		}
		return group;
	}

	private makeChesterfield() {
		const group = new THREE.Group();
		const leather = 0x63362f;
		group.add(box([2.9, 0.5, 1.15], [0, 0.45, 0], leather));
		group.add(box([2.68, 0.86, 0.34], [0, 0.96, -0.43], leather, -0.08));
		for (const x of [-1.48, 1.48]) {
			const arm = cylinder(0.34, 0.34, 1.12, [x, 0.73, 0], leather, 16);
			arm.rotation.x = Math.PI / 2;
			group.add(arm);
			group.add(box([0.12, 0.22, 0.12], [x, 0.11, -0.37], 0x3e2921));
			group.add(box([0.12, 0.22, 0.12], [x, 0.11, 0.37], 0x3e2921));
		}
		for (let row = 0; row < 2; row += 1) {
			for (let column = 0; column < 6; column += 1) {
				const button = shadowMesh(new THREE.SphereGeometry(0.035, 8, 6), material(0x37231f));
				button.position.set(-1.05 + column * 0.42, 0.77 + row * 0.3, -0.625);
				group.add(button);
			}
		}
		return group;
	}

	private makeOldTrunk() {
		const group = new THREE.Group();
		group.add(box([1.48, 0.64, 0.9], [0, 0.32, 0], 0x70482f));
		group.add(cylinder(0.46, 0.46, 1.48, [0, 0.64, 0], 0x81543a, 18));
		for (const x of [-0.48, 0.48]) {
			group.add(box([0.11, 0.76, 0.94], [x, 0.42, 0], 0x3f322a));
		}
		group.add(box([0.22, 0.22, 0.07], [0, 0.42, 0.485], 0xc09148));
		return group;
	}

	private makeGramophone() {
		const group = new THREE.Group();
		group.add(box([0.92, 0.72, 0.78], [0, 0.36, 0], 0x68442e));
		const stem = cylinder(0.065, 0.08, 0.56, [0, 0.98, 0], 0x806544, 10);
		stem.rotation.z = -0.25;
		group.add(stem);
		const horn = shadowMesh(
			new THREE.ConeGeometry(0.47, 0.72, 18, 1, true),
			material(0xa27842, 0.38, 0.3)
		);
		horn.rotation.z = -Math.PI / 2 - 0.25;
		horn.position.set(0.32, 1.3, 0);
		group.add(horn);
		return group;
	}

	private makeArtwork(source: string) {
		const group = new THREE.Group();
		group.add(box([1.55, 1.9, 0.14], [0, 0, 0], COLORS.ink));
		const pictureMaterial = new THREE.MeshBasicMaterial({ color: 0xe8d9ca });
		const picture = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.7), pictureMaterial);
		picture.position.z = 0.08;
		group.add(picture);
		new THREE.TextureLoader().load(source, (texture) => {
			texture.colorSpace = THREE.SRGBColorSpace;
			pictureMaterial.map = texture;
			pictureMaterial.needsUpdate = true;
		});
		return group;
	}

	private createToiletRoomDecor() {
		const rabbitArt: Array<{
			source: string;
			x: number;
			y: number;
			scale: number;
			rotation: number;
		}> = [
			{ source: '/images/artwork/3.webp', x: -13.25, y: 1.48, scale: 0.27, rotation: -0.08 },
			{ source: '/images/artwork/7.webp', x: -12.48, y: 1.65, scale: 0.31, rotation: 0.05 },
			{ source: '/images/artwork/14.webp', x: -11.62, y: 1.45, scale: 0.26, rotation: -0.04 },
			{ source: '/images/artwork/18.webp', x: -9.78, y: 1.62, scale: 0.3, rotation: 0.08 },
			{ source: '/images/artwork/24.webp', x: -9.02, y: 1.46, scale: 0.25, rotation: -0.06 }
		];
		for (const art of rabbitArt) {
			const frame = this.makeArtwork(art.source);
			frame.position.set(art.x, art.y, BACK_WALL_Z + 0.18);
			frame.scale.setScalar(art.scale);
			frame.rotation.z = art.rotation;
			this.scene.add(frame);
		}

		const sideArt = this.makeArtwork('/images/artwork/29.webp');
		sideArt.position.set(LEFT_ROOMS_MIN_X + 0.18, 1.34, -3.18);
		sideArt.scale.setScalar(0.3);
		sideArt.rotation.set(0, Math.PI / 2, -0.05);
		this.scene.add(sideArt);

		const calendar = this.makeToiletCalendar();
		calendar.position.set(-10.62, 1.3, BACK_WALL_Z + 0.18);
		this.scene.add(calendar);

		const plunger = new THREE.Group();
		plunger.add(cylinder(0.085, 0.21, 0.2, [0, 0.1, 0], 0xb84c3e, 18));
		plunger.add(cylinder(0.03, 0.034, 0.88, [0, 0.62, 0], 0x876044, 10));
		plunger.position.set(-13.16, 0, -2.82);
		plunger.rotation.z = -0.12;
		this.scene.add(plunger);

		const toiletBrush = new THREE.Group();
		toiletBrush.add(cylinder(0.14, 0.12, 0.34, [0, 0.17, 0], 0xe8e1d5, 16));
		toiletBrush.add(cylinder(0.026, 0.026, 0.72, [0, 0.67, 0], 0x3e4744, 10));
		const brushGrip = shadowMesh(new THREE.SphereGeometry(0.055, 10, 8), material(0x3e4744));
		brushGrip.position.y = 1.04;
		toiletBrush.add(brushGrip);
		toiletBrush.position.set(-13.2, 0, -3.58);
		this.scene.add(toiletBrush);

		const toiletCleaner = this.makeToiletCleaner();
		toiletCleaner.position.set(-9.62, 0, -4.22);
		toiletCleaner.rotation.y = -0.08;
		this.scene.add(toiletCleaner);
	}

	private makeToiletCalendar() {
		const group = new THREE.Group();
		group.add(box([0.78, 1.04, 0.055], [0, 0, 0], 0x59453b));
		const canvas = document.createElement('canvas');
		canvas.width = 384;
		canvas.height = 512;
		const context = canvas.getContext('2d');
		if (context) {
			context.fillStyle = '#f6eddc';
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.fillStyle = '#ef7f31';
			context.fillRect(0, 0, canvas.width, 132);
			context.fillStyle = '#251f1b';
			context.textAlign = 'center';
			context.font = '900 46px system-ui, sans-serif';
			context.fillText('WC-KONIJN', canvas.width / 2, 54);
			context.font = '800 34px system-ui, sans-serif';
			context.fillText('JULI', canvas.width / 2, 108);
			context.lineWidth = 4;
			context.strokeStyle = '#251f1b';
			const gridTop = 160;
			const cellWidth = canvas.width / 7;
			const cellHeight = 62;
			for (let column = 0; column <= 7; column += 1) {
				context.beginPath();
				context.moveTo(column * cellWidth, gridTop);
				context.lineTo(column * cellWidth, gridTop + cellHeight * 5);
				context.stroke();
			}
			for (let row = 0; row <= 5; row += 1) {
				context.beginPath();
				context.moveTo(0, gridTop + row * cellHeight);
				context.lineTo(canvas.width, gridTop + row * cellHeight);
				context.stroke();
			}
			context.font = '700 22px system-ui, sans-serif';
			context.textBaseline = 'middle';
			for (let day = 1; day <= 31; day += 1) {
				const index = day + 1;
				const column = index % 7;
				const row = Math.floor(index / 7);
				const x = column * cellWidth + cellWidth / 2;
				const y = gridTop + row * cellHeight + cellHeight / 2;
				if (day === 29) {
					context.fillStyle = '#ef7f31';
					context.beginPath();
					context.arc(x, y, 22, 0, Math.PI * 2);
					context.fill();
				}
				context.fillStyle = '#251f1b';
				context.fillText(String(day), x, y);
			}
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const sheet = new THREE.Mesh(
			new THREE.PlaneGeometry(0.72, 0.98),
			new THREE.MeshBasicMaterial({ map: texture })
		);
		sheet.position.z = 0.032;
		group.add(sheet);
		return group;
	}

	private makeToiletCleaner() {
		const group = new THREE.Group();
		const bottle = shadowMesh(
			new THREE.CapsuleGeometry(0.15, 0.3, 5, 12),
			material(0x2f8d83, 0.66)
		);
		bottle.scale.z = 0.68;
		bottle.position.y = 0.3;
		group.add(bottle);
		const neck = cylinder(0.065, 0.08, 0.17, [0.035, 0.61, 0], 0x2f8d83, 12);
		neck.rotation.z = -0.24;
		const cap = cylinder(0.076, 0.076, 0.07, [0.055, 0.72, 0], COLORS.orange, 12);
		cap.rotation.z = -0.24;
		group.add(neck, cap);

		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;
		const context = canvas.getContext('2d');
		if (context) {
			context.fillStyle = '#f6eddc';
			context.beginPath();
			context.roundRect(10, 10, 236, 236, 30);
			context.fill();
			context.fillStyle = '#ef7f31';
			context.font = '900 58px system-ui, sans-serif';
			context.textAlign = 'center';
			context.fillText('WC', 128, 78);
			context.fillStyle = '#251f1b';
			context.font = '900 34px system-ui, sans-serif';
			context.fillText('KONIJN', 128, 224);
			context.strokeStyle = '#251f1b';
			context.lineWidth = 10;
			context.beginPath();
			context.ellipse(128, 143, 48, 42, 0, 0, Math.PI * 2);
			context.moveTo(103, 113);
			context.lineTo(94, 88);
			context.moveTo(153, 113);
			context.lineTo(162, 88);
			context.stroke();
			context.fillStyle = '#251f1b';
			context.beginPath();
			context.arc(111, 141, 5, 0, Math.PI * 2);
			context.arc(145, 141, 5, 0, Math.PI * 2);
			context.fill();
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const label = new THREE.Mesh(
			new THREE.PlaneGeometry(0.24, 0.25),
			new THREE.MeshBasicMaterial({ map: texture, transparent: true })
		);
		label.position.set(0, 0.3, 0.105);
		group.add(label);
		return group;
	}

	private makeFruitBowl() {
		const group = new THREE.Group();
		const bowl = shadowMesh(
			new THREE.SphereGeometry(0.44, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
			material(0x5c84a3)
		);
		bowl.scale.y = 0.5;
		group.add(bowl);
		for (let index = 0; index < 5; index += 1) {
			const fruit = shadowMesh(
				new THREE.SphereGeometry(0.15, 10, 8),
				material(index % 2 ? COLORS.yellow : COLORS.orange)
			);
			fruit.position.set((index - 2) * 0.14, 0.18 + (index % 2) * 0.08, ((index % 3) - 1) * 0.12);
			group.add(fruit);
		}
		return group;
	}

	private makeStool() {
		const group = new THREE.Group();
		group.add(cylinder(0.55, 0.55, 0.18, [0, 0.74, 0], COLORS.pink, 24));
		for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
			const leg = cylinder(
				0.06,
				0.08,
				0.68,
				[Math.cos(angle) * 0.35, 0.34, Math.sin(angle) * 0.35],
				COLORS.ink,
				10
			);
			leg.rotation.z = Math.cos(angle) * 0.16;
			leg.rotation.x = Math.sin(angle) * 0.16;
			group.add(leg);
		}
		return group;
	}

	private makeBarbecue() {
		const group = new THREE.Group();
		const bowl = shadowMesh(
			new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
			material(0x292725, 0.38, 0.42)
		);
		bowl.position.y = 0.96;
		group.add(bowl);
		const lid = shadowMesh(
			new THREE.SphereGeometry(0.64, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
			material(0x36322f, 0.32, 0.46)
		);
		lid.position.y = 1.04;
		group.add(lid);
		group.add(box([0.38, 0.09, 0.11], [0, 1.68, 0], COLORS.ink));
		for (const x of [-0.38, 0.38]) {
			const leg = cylinder(0.045, 0.055, 0.86, [x, 0.43, 0], COLORS.ink, 9);
			leg.rotation.z = x * 0.2;
			group.add(leg);
		}
		const shelf = box([1.15, 0.08, 0.48], [0, 0.42, 0], 0x6d6259);
		group.add(shelf);
		return group;
	}

	private makeDoghouse() {
		const group = new THREE.Group();
		group.add(box([1.72, 0.14, 1.72], [0, 0.07, 0], 0x6f4b39));
		group.add(box([1.56, 1.06, 1.5], [0, 0.6, 0], 0xc76c45));

		const leftRoof = box([1.08, 0.14, 1.92], [-0.42, 1.38, 0], 0x5e4438);
		leftRoof.rotation.z = -0.58;
		const rightRoof = box([1.08, 0.14, 1.92], [0.42, 1.38, 0], 0x5e4438);
		rightRoof.rotation.z = 0.58;
		group.add(leftRoof, rightRoof);

		const doorwayShape = new THREE.Shape();
		doorwayShape.moveTo(-0.37, -0.48);
		doorwayShape.lineTo(-0.37, 0.08);
		doorwayShape.absarc(0, 0.08, 0.37, Math.PI, 0, true);
		doorwayShape.lineTo(0.37, -0.48);
		doorwayShape.closePath();
		const doorway = new THREE.Mesh(
			new THREE.ShapeGeometry(doorwayShape, 12),
			new THREE.MeshBasicMaterial({ color: COLORS.ink })
		);
		doorway.position.set(0, 0.54, 0.756);
		group.add(doorway);

		const bone = new THREE.Group();
		bone.add(box([0.42, 0.09, 0.06], [0, 0, 0], COLORS.cream));
		for (const x of [-0.24, 0.24]) {
			const end = shadowMesh(new THREE.SphereGeometry(0.09, 10, 8), material(COLORS.cream));
			end.position.x = x;
			bone.add(end);
		}
		bone.position.set(0, 1.12, 0.82);
		group.add(bone);
		return group;
	}

	private makeGardenChair(color: number) {
		const group = new THREE.Group();
		const seat = box([1.08, 0.16, 1.08], [0, 0.58, 0], color);
		seat.rotation.x = -0.08;
		group.add(seat);
		const back = box([1.08, 0.16, 1.05], [0, 1.0, -0.46], color);
		back.rotation.x = -0.34;
		group.add(back);
		for (const x of [-0.43, 0.43]) {
			const leg = box([0.12, 0.62, 0.12], [x, 0.3, 0.18], COLORS.ink);
			leg.rotation.x = x > 0 ? 0.08 : -0.08;
			group.add(leg);
			group.add(box([0.12, 0.76, 0.12], [x, 0.42, -0.38], COLORS.ink));
		}
		return group;
	}

	private makePool() {
		const group = new THREE.Group();
		group.add(cylinder(2.06, 2.12, 0.68, [0, 0.34, 0], 0x4fa7c7, 32));
		const water = new THREE.Mesh(
			new THREE.CircleGeometry(1.86, 40),
			new THREE.MeshStandardMaterial({
				color: 0x62c7df,
				roughness: 0.18,
				transparent: true,
				opacity: 0.78,
				depthWrite: false
			})
		);
		water.rotation.x = -Math.PI / 2;
		water.position.y = 0.7;
		group.add(water);
		const rim = shadowMesh(new THREE.TorusGeometry(1.98, 0.16, 10, 40), material(0xf0e6d5, 0.86));
		rim.rotation.x = Math.PI / 2;
		rim.position.y = 0.72;
		group.add(rim);
		return group;
	}

	private makeFridge() {
		const group = new THREE.Group();
		group.add(box([1.22, 2.34, 1.04], [0, 1.17, 0], 0xd9ddd8));
		group.add(box([1.24, 0.045, 1.06], [0, 1.48, 0.01], 0x817e79));
		group.add(box([0.055, 0.62, 0.07], [0.42, 1.88, 0.55], 0x5d605f));
		group.add(box([0.055, 0.36, 0.07], [0.42, 1.18, 0.55], 0x5d605f));
		const magnet = box([0.22, 0.18, 0.025], [-0.3, 1.92, 0.548], COLORS.orange);
		magnet.rotation.z = -0.08;
		group.add(magnet);
		return group;
	}

	private makeKitchenIsland() {
		const group = new THREE.Group();
		group.add(box([2.15, 0.84, 1.06], [0, 0.42, 0], 0x6f8e69));
		group.add(box([2.48, 0.16, 1.34], [0, 0.93, 0], 0x4a403a));
		group.add(box([0.7, 0.045, 0.48], [-0.38, 1.025, 0.05], 0xa9aaa3));
		for (const z of [-0.27, 0.27]) {
			const burner = shadowMesh(new THREE.TorusGeometry(0.17, 0.025, 8, 20), material(0x292624));
			burner.rotation.x = Math.PI / 2;
			burner.position.set(0.55, 1.025, z);
			group.add(burner);
		}
		return group;
	}

	private makeKitchenHatch() {
		const group = new THREE.Group();
		const plankDepth = KITCHEN_HATCH_DEPTH / 4;
		for (let index = 0; index < 4; index += 1) {
			group.add(
				box(
					[KITCHEN_HATCH_WIDTH - 0.08, 0.08, plankDepth - 0.035],
					[0, 0.04, -KITCHEN_HATCH_DEPTH / 2 + plankDepth * (index + 0.5)],
					index % 2 === 0 ? 0x795036 : 0x895c3d
				)
			);
		}
		group.add(
			box([0.11, 0.045, KITCHEN_HATCH_DEPTH - 0.12], [-0.53, 0.1, 0], 0x4c3327),
			box([0.11, 0.045, KITCHEN_HATCH_DEPTH - 0.12], [0.53, 0.1, 0], 0x4c3327)
		);
		const handle = shadowMesh(
			new THREE.TorusGeometry(0.13, 0.026, 8, 18),
			material(0x4a4038, 0.5, 0.3)
		);
		handle.rotation.x = Math.PI / 2;
		handle.position.set(0.35, 0.135, 0);
		group.add(handle);

		this.kitchenHatchDamage = new THREE.Group();
		for (const [rotation, x, z] of [
			[-0.62, -0.22, -0.04],
			[0.68, 0.08, 0.08],
			[-0.18, 0.28, -0.16]
		] as Array<[number, number, number]>) {
			const crack = box([0.7, 0.018, 0.045], [x, 0.142, z], 0x2e241f);
			crack.rotation.y = rotation;
			this.kitchenHatchDamage.add(crack);
		}
		this.kitchenHatchDamage.visible = false;
		group.add(this.kitchenHatchDamage);
		return group;
	}

	private makeToilet() {
		const group = new THREE.Group();
		group.add(cylinder(0.28, 0.36, 0.42, [0, 0.21, 0], 0xe8e5dd, 18));
		const bowl = shadowMesh(new THREE.TorusGeometry(0.31, 0.105, 10, 24), material(0xefede6, 0.38));
		bowl.rotation.x = Math.PI / 2;
		bowl.scale.z = 1.18;
		bowl.position.set(0, 0.52, 0.08);
		group.add(bowl);
		const water = new THREE.Mesh(
			new THREE.CircleGeometry(0.235, 24),
			new THREE.MeshStandardMaterial({ color: 0x8eb8b7, roughness: 0.35 })
		);
		water.rotation.x = -Math.PI / 2;
		water.scale.z = 1.16;
		water.position.set(0, 0.515, 0.08);
		group.add(water);
		this.toiletFillRoot = new THREE.Group();
		this.toiletFillRoot.position.set(0, 0.535, 0.08);
		group.add(this.toiletFillRoot);
		group.add(box([0.54, 0.6, 0.3], [0, 0.78, -0.25], 0xe1dfd7));
		group.add(box([0.56, 0.08, 0.32], [0, 1.1, -0.25], 0xefede6));
		return group;
	}

	private makeBed() {
		const group = new THREE.Group();
		group.add(box([2.3, 0.38, 1.5], [0, 0.19, 0], 0x6f5142));
		group.add(box([2.16, 0.28, 1.4], [0, 0.5, 0.04], 0xe1c9b6));
		group.add(box([2.1, 0.1, 0.72], [0, 0.67, 0.35], 0x8e6f87));
		group.add(box([0.72, 0.18, 0.52], [-0.58, 0.72, -0.36], 0xeee5d8));
		group.add(box([0.72, 0.18, 0.52], [0.58, 0.72, -0.36], 0xeee5d8));
		group.add(box([2.34, 0.92, 0.14], [0, 0.46, -0.74], 0x6f5142));
		return group;
	}

	private makeAppleTree() {
		const group = new THREE.Group();
		group.add(cylinder(0.27, 0.43, 2.65, [0, 1.32, 0], 0x76503a, 14));
		const crownPositions: Array<[number, number, number, number]> = [
			[0, 3.05, 0, 1.15],
			[-0.9, 2.9, 0.12, 0.9],
			[0.88, 2.92, 0.08, 0.92],
			[-0.35, 3.62, -0.12, 0.86],
			[0.48, 3.55, 0.15, 0.82]
		];
		for (const [x, y, z, scale] of crownPositions) {
			const crown = shadowMesh(
				new THREE.DodecahedronGeometry(scale, 1),
				material(y > 3.4 ? 0x5d8444 : 0x52783d, 0.96)
			);
			crown.scale.set(1.12, 0.94, 1);
			crown.position.set(x, y, z);
			group.add(crown);
		}
		const apples: Array<[number, number, number]> = [
			[-0.78, 3.18, 0.72],
			[0.72, 3.42, 0.76],
			[0.08, 2.62, 1.04],
			[-0.22, 3.86, 0.54],
			[1.1, 2.86, 0.28],
			[-1.05, 2.74, -0.18]
		];
		for (const [x, y, z] of apples) {
			const apple = shadowMesh(new THREE.SphereGeometry(0.15, 10, 8), material(0xc94f43, 0.72));
			apple.position.set(x, y, z);
			group.add(apple);
		}
		const birdhouse = this.makeBirdhouse();
		birdhouse.position.set(0.65, 2.45, 0.4);
		group.add(birdhouse);
		return group;
	}

	private makeBirdhouse() {
		const group = new THREE.Group();
		group.add(box([0.72, 0.62, 0.58], [0, 0.36, 0], COLORS.yellow));
		const roof = shadowMesh(new THREE.ConeGeometry(0.58, 0.42, 4), material(0xb65d43, 0.84));
		roof.rotation.y = Math.PI / 4;
		roof.position.y = 0.86;
		group.add(roof);
		const entrance = new THREE.Mesh(
			new THREE.CircleGeometry(0.13, 16),
			new THREE.MeshBasicMaterial({ color: COLORS.ink })
		);
		entrance.position.set(0, 0.44, 0.3);
		group.add(entrance);
		const perch = cylinder(0.025, 0.025, 0.32, [0, 0.23, 0.42], COLORS.ink, 8);
		perch.rotation.x = Math.PI / 2;
		group.add(perch);
		return group;
	}

	private makePriceTag(text: string) {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 96;
		const context = canvas.getContext('2d');
		if (context) {
			context.fillStyle = '#251f1b';
			context.beginPath();
			context.roundRect(10, 10, 236, 76, 18);
			context.fill();
			context.fillStyle = '#f6eddc';
			context.font = '700 46px system-ui, sans-serif';
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillText(text, 128, 50);
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true })
		);
		sprite.scale.set(1.05, 0.4, 1);
		return sprite;
	}

	private firstMaterialColor(group: THREE.Group) {
		let result: THREE.Color | null = null;
		group.traverse((child) => {
			if (result || !(child instanceof THREE.Mesh)) return;
			const meshMaterial = child.material;
			if (meshMaterial instanceof THREE.MeshStandardMaterial) result = meshMaterial.color.clone();
		});
		return result;
	}

	private animate = (timestamp = performance.now()) => {
		this.frame = requestAnimationFrame(this.animate);
		this.timer.update(timestamp);
		const delta = Math.min(this.timer.getDelta(), 0.034);
		if (!this.paused) {
			if (this.phase === 'playing') this.updateGame(delta);
			this.updateDebris(delta);
			this.updateImpactRings(delta);
			this.updateWeaponProjectiles(delta);
			this.updateMuzzleEffects(delta);
			this.updateToilet(delta);
		}
		this.updateCamera(delta);
		this.renderer.render(this.scene, this.camera);
	};

	private updateGame(delta: number) {
		this.syncUpstairsVisibility();
		this.weaponCooldown = Math.max(0, this.weaponCooldown - delta);
		this.basementEntryCooldown = Math.max(0, this.basementEntryCooldown - delta);
		for (let index = 0; index < this.upstairsLights.length; index += 1) {
			const target = this.playerUpstairs ? UPSTAIRS_LIGHT_INTENSITIES[index] : 0;
			this.upstairsLights[index].intensity = THREE.MathUtils.lerp(
				this.upstairsLights[index].intensity,
				target,
				1 - Math.exp(-4.5 * delta)
			);
		}
		if (this.weaponHeld && this.weaponCooldown <= 0) {
			this.useWeapon();
		}
		this.updateDoor(delta);

		const desired = this.getPointerDirection();
		if (desired.lengthSq() > 0) {
			const targetSpeed = this.stomping ? 5.8 : 4.8;
			const response = 1 - Math.exp(-3.2 * delta);
			this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, desired.x * targetSpeed, response);
			this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, desired.z * targetSpeed, response);
		} else {
			const airDrag = Math.exp(-0.7 * delta);
			this.velocity.x *= airDrag;
			this.velocity.z *= airDrag;
		}

		if (desired.lengthSq() > 0.01) {
			const facing = Math.atan2(desired.x, desired.z);
			this.player.rotation.y = THREE.MathUtils.lerp(
				this.player.rotation.y,
				facing,
				1 - Math.exp(-10 * delta)
			);
		}

		if (this.stomping) {
			this.stompTimeout = Math.max(0, this.stompTimeout - delta);
			if (this.stompTimeout <= 0) this.cancelStamp();
		}

		if (this.stompWindup > 0) {
			this.stompWindup -= delta;
			if (this.stompWindup <= 0) {
				if (this.stampTargetKind === 'floor') this.velocity.y = -18;
				else this.velocity.copy(this.stampDirection).multiplyScalar(18);
			}
		} else {
			this.velocity.y -= 20 * delta;
		}
		this.rabbitTumble.quaternion.slerp(
			this.stomping ? this.stampPose : this.uprightPose,
			1 - Math.exp(-(this.stomping ? 22 : 7) * delta)
		);

		this.player.position.addScaledVector(this.velocity, delta);
		if (this.playerInSewer) {
			this.player.position.z = SEWER_CENTER_Z;
			this.velocity.z = 0;
		}
		this.resolveRoomCollisions();
		this.resolveBreakables(delta);
		this.updateArmRagdolls(delta);

		this.squash = Math.max(0, this.squash - delta * 4.8);
		const squashEase = this.squash * this.squash;
		this.rabbitSquash.scale.set(
			1 + squashEase * 0.18,
			1 - squashEase * 0.28,
			1 + squashEase * 0.18
		);
		this.rabbitSquash.position.y = -PLAYER_HEIGHT / 2 + squashEase * 0.03;
		this.emitHud();
	}

	private syncUpstairsVisibility() {
		this.upstairsRoot.visible = this.playerUpstairs;
		for (const breakable of this.upstairsBreakables) {
			breakable.group.visible = this.playerUpstairs && !breakable.broken;
		}
	}

	private resolveRoomCollisions() {
		let wallNormal: THREE.Vector3 | null = null;
		let wallImpactSpeed = 0;
		if (this.playerInSewer) {
			const leftLimit = SEWER_MIN_X + PLAYER_RADIUS;
			const rightLimit = SEWER_MAX_X - PLAYER_RADIUS;
			if (this.player.position.x < leftLimit) {
				wallImpactSpeed = Math.abs(this.velocity.x);
				this.player.position.x = leftLimit;
				wallNormal = new THREE.Vector3(1, 0, 0);
				this.velocity.x *= -0.78;
			} else if (this.player.position.x > rightLimit) {
				wallImpactSpeed = Math.abs(this.velocity.x);
				this.player.position.x = rightLimit;
				wallNormal = new THREE.Vector3(-1, 0, 0);
				this.velocity.x *= -0.78;
			}
		} else if (this.playerInBasement) {
			const leftLimit = BASEMENT_MIN_X + PLAYER_RADIUS;
			const rightLimit = BASEMENT_MAX_X - PLAYER_RADIUS;
			if (this.player.position.x < leftLimit) {
				wallImpactSpeed = Math.abs(this.velocity.x);
				this.player.position.x = leftLimit;
				wallNormal = new THREE.Vector3(1, 0, 0);
				this.velocity.x *= -0.78;
			} else if (this.player.position.x > rightLimit) {
				wallImpactSpeed = Math.abs(this.velocity.x);
				this.player.position.x = rightLimit;
				wallNormal = new THREE.Vector3(-1, 0, 0);
				this.velocity.x *= -0.78;
			}
		} else if (this.playerUpstairs) {
			const leftLimit = UPSTAIRS_MIN_X + PLAYER_RADIUS;
			const rightLimit = UPSTAIRS_MAX_X - PLAYER_RADIUS;
			if (this.player.position.x < leftLimit && this.player.position.z < STAIR_TURN_STEP_ONE_Z) {
				this.playerUpstairs = false;
				this.playerLeftRoom = 'stairs';
				this.player.position.set(
					LEFT_ROOMS_MIN_X + PLAYER_RADIUS + 0.18,
					STAIR_STEP_RISE * (STAIR_STRAIGHT_STEP_COUNT + 1),
					STAIR_TURN_STEP_ONE_Z - 0.08
				);
				this.velocity.set(2.7, -1.2, 1.4);
				this.callbacks.onFeedback('TERUG DE TRAP AF!');
				return;
			} else if (this.player.position.x < leftLimit) {
				wallImpactSpeed = Math.abs(this.velocity.x);
				this.player.position.x = leftLimit;
				wallNormal = new THREE.Vector3(1, 0, 0);
				this.velocity.x *= -0.78;
			} else if (this.player.position.x > rightLimit) {
				wallImpactSpeed = Math.abs(this.velocity.x);
				this.player.position.x = rightLimit;
				wallNormal = new THREE.Vector3(-1, 0, 0);
				this.velocity.x *= -0.78;
			}
		} else if (this.playerOutside) {
			const xLimit = GARDEN_WIDTH / 2 - PLAYER_RADIUS;
			if (Math.abs(this.player.position.x) > xLimit) {
				wallImpactSpeed = Math.max(wallImpactSpeed, Math.abs(this.velocity.x));
				const side = Math.sign(this.player.position.x);
				this.player.position.x = side * xLimit;
				wallNormal = new THREE.Vector3(-side, 0, 0);
				this.velocity.x *= -0.78;
			}
		} else if (this.playerLeftRoom) {
			const leftLimit = LEFT_ROOMS_MIN_X + PLAYER_RADIUS;
			const livingWallLimit = LEFT_ROOMS_MAX_X - PLAYER_RADIUS;
			if (
				this.playerLeftRoom === 'stairs' &&
				this.player.position.x <= STAIR_TOP_X &&
				this.player.position.z <= STAIR_TURN_STEP_TWO_Z &&
				this.player.position.y >=
					STAIR_STEP_RISE * (STAIR_STRAIGHT_STEP_COUNT + STAIR_TURN_STEP_COUNT - 1)
			) {
				this.playerLeftRoom = null;
				this.playerUpstairs = true;
				this.player.position.set(UPSTAIRS_STAIRWELL_X + 0.88, UPSTAIRS_FLOOR_Y, -0.78);
				this.velocity.set(Math.max(1.8, this.velocity.x), Math.min(this.velocity.y, 1.6), 1.2);
				this.callbacks.onFeedback('BOVENVERDIEPING!');
				return;
			} else if (this.player.position.x < leftLimit) {
				wallImpactSpeed = Math.max(wallImpactSpeed, Math.abs(this.velocity.x));
				this.player.position.x = leftLimit;
				wallNormal = new THREE.Vector3(1, 0, 0);
				this.velocity.x *= -0.78;
			} else if (this.player.position.x > livingWallLimit) {
				const roomDoor = this.leftRoomDoors.find((door) => door.room === this.playerLeftRoom);
				if (roomDoor?.open && this.isInsideLeftDoorPassage(roomDoor)) {
					if (this.player.position.x > LEFT_ROOMS_MAX_X) this.playerLeftRoom = null;
				} else {
					wallImpactSpeed = Math.max(wallImpactSpeed, Math.abs(this.velocity.x));
					this.player.position.x = livingWallLimit;
					wallNormal = new THREE.Vector3(-1, 0, 0);
					this.velocity.x *= -0.78;
				}
			}
		} else if (this.playerInKitchen) {
			const kitchenRightLimit = KITCHEN_MAX_X - PLAYER_RADIUS;
			const kitchenLeftLimit = KITCHEN_MIN_X + PLAYER_RADIUS;
			if (this.player.position.x > kitchenRightLimit) {
				wallImpactSpeed = Math.max(wallImpactSpeed, Math.abs(this.velocity.x));
				this.player.position.x = kitchenRightLimit;
				wallNormal = new THREE.Vector3(-1, 0, 0);
				this.velocity.x *= -0.78;
			} else if (this.player.position.x < kitchenLeftLimit) {
				if (this.doorOpen && this.isInsideDoorPassage()) {
					if (this.player.position.x < KITCHEN_MIN_X) this.playerInKitchen = false;
				} else {
					wallImpactSpeed = Math.max(wallImpactSpeed, Math.abs(this.velocity.x));
					this.player.position.x = kitchenLeftLimit;
					wallNormal = new THREE.Vector3(1, 0, 0);
					this.velocity.x *= -0.78;
				}
			}
		} else {
			const roomLeftLimit = -ROOM_WIDTH / 2 + PLAYER_RADIUS;
			const roomRightLimit = ROOM_WIDTH / 2 - PLAYER_RADIUS;
			if (this.player.position.x < roomLeftLimit) {
				const openDoor = this.leftRoomDoors.find(
					(door) => door.open && this.isInsideLeftDoorPassage(door)
				);
				if (openDoor) {
					if (this.player.position.x < LEFT_ROOMS_MAX_X) this.playerLeftRoom = openDoor.room;
				} else {
					wallImpactSpeed = Math.max(wallImpactSpeed, Math.abs(this.velocity.x));
					this.player.position.x = roomLeftLimit;
					wallNormal = new THREE.Vector3(1, 0, 0);
					this.velocity.x *= -0.78;
				}
			} else if (this.player.position.x > roomRightLimit) {
				if (this.doorOpen && this.isInsideDoorPassage()) {
					if (this.player.position.x > KITCHEN_MIN_X) this.playerInKitchen = true;
				} else {
					wallImpactSpeed = Math.max(wallImpactSpeed, Math.abs(this.velocity.x));
					this.player.position.x = roomRightLimit;
					wallNormal = new THREE.Vector3(-1, 0, 0);
					this.velocity.x *= -0.78;
				}
			}
		}

		if (this.playerInSewer) {
			const backLimit = SEWER_MIN_Z + PLAYER_RADIUS;
			const frontLimit = SEWER_MAX_Z - PLAYER_RADIUS;
			if (this.player.position.z < backLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = backLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, 1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			} else if (this.player.position.z > frontLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = frontLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, -1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			}
		} else if (this.playerInBasement) {
			const backLimit = BACK_WALL_Z + PLAYER_RADIUS;
			const frontLimit = ROOM_DEPTH / 2 - PLAYER_RADIUS;
			if (this.player.position.z < backLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = backLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, 1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			} else if (this.player.position.z > frontLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = frontLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, -1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			}
		} else if (this.playerUpstairs) {
			const backLimit = BACK_WALL_Z + PLAYER_RADIUS;
			const frontLimit = ROOM_DEPTH / 2 - PLAYER_RADIUS;
			if (this.player.position.z < backLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = backLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, 1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			} else if (this.player.position.z > frontLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = frontLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, -1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			}
		} else if (this.playerOutside) {
			const gardenBackLimit = GARDEN_BACK_Z + PLAYER_RADIUS;
			const houseLimit = BACK_WALL_Z - PLAYER_RADIUS;
			if (this.player.position.z < gardenBackLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = gardenBackLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, 1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			} else if (this.player.position.z > houseLimit) {
				if (this.windowBroken && this.isInsideWindowPassage()) {
					if (this.player.position.z > BACK_WALL_Z) this.playerOutside = false;
				} else {
					const zImpact = Math.abs(this.velocity.z);
					this.player.position.z = houseLimit;
					if (!wallNormal || zImpact > wallImpactSpeed) {
						wallNormal = new THREE.Vector3(0, 0, -1);
					}
					wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
					this.velocity.z *= -0.78;
				}
			}
		} else if (this.playerLeftRoom) {
			const bounds = this.getLeftRoomZBounds(this.playerLeftRoom);
			const frontLimit = bounds.maxZ - PLAYER_RADIUS;
			const backLimit = bounds.minZ + PLAYER_RADIUS;
			if (this.player.position.z > frontLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = frontLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, -1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			} else if (this.player.position.z < backLimit) {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = backLimit;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, 1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			}
		} else if (this.player.position.z > ROOM_DEPTH / 2 - PLAYER_RADIUS) {
			const zImpact = Math.abs(this.velocity.z);
			this.player.position.z = ROOM_DEPTH / 2 - PLAYER_RADIUS;
			if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, -1);
			wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
			this.velocity.z *= -0.78;
		} else if (this.player.position.z < BACK_WALL_Z + PLAYER_RADIUS) {
			if (
				!this.playerInKitchen &&
				!this.playerLeftRoom &&
				this.windowBroken &&
				this.isInsideWindowPassage()
			) {
				if (this.player.position.z < BACK_WALL_Z) this.playerOutside = true;
			} else {
				const zImpact = Math.abs(this.velocity.z);
				this.player.position.z = BACK_WALL_Z + PLAYER_RADIUS;
				if (!wallNormal || zImpact > wallImpactSpeed) wallNormal = new THREE.Vector3(0, 0, 1);
				wallImpactSpeed = Math.max(wallImpactSpeed, zImpact);
				this.velocity.z *= -0.78;
			}
		}
		if (wallNormal) {
			const leftDoor = this.stampTargetLeftDoor;
			const leftDoorStamp =
				leftDoor !== null &&
				!leftDoor.open &&
				wallNormal.x > 0.72 &&
				wallImpactSpeed >= GOOD_DOOR_STAMP_SPEED &&
				this.isInsideLeftDoorTarget(leftDoor);
			const doorStamp =
				!this.doorOpen &&
				this.stampTargetsDoor &&
				wallNormal.x < -0.72 &&
				wallImpactSpeed >= GOOD_DOOR_STAMP_SPEED &&
				this.isInsideDoorTarget();
			const lockedBackDoorStamp =
				this.playerInKitchen &&
				wallNormal.z > 0.72 &&
				wallImpactSpeed >= 4.5 &&
				this.isTargetStampSurface(wallNormal) &&
				this.isInsideLockedBackDoorTarget();
			const windowStamp =
				!this.windowBroken &&
				this.stampTargetsWindow &&
				wallNormal.z > 0.72 &&
				wallImpactSpeed >= GOOD_WINDOW_STAMP_SPEED &&
				this.isInsideWindowTarget();
			if (leftDoorStamp && leftDoor) {
				this.performLeftDoorStamp(leftDoor, wallImpactSpeed);
				return;
			} else if (doorStamp) {
				this.performDoorStamp(wallImpactSpeed);
				return;
			} else if (lockedBackDoorStamp) {
				this.performLockedBackDoorStamp(wallImpactSpeed, wallNormal);
				return;
			} else if (windowStamp) {
				const brokeThrough = this.performWindowStamp(wallImpactSpeed, wallNormal);
				if (brokeThrough) return;
				this.finishStampRebound(wallNormal, 0.86, wallImpactSpeed);
				this.callbacks.onFeedback('RAAM BARST! NOG 1 GOEDE STAMP!');
			} else if (this.isTargetStampSurface(wallNormal) && wallImpactSpeed > 2.8) {
				this.performWallStamp(wallImpactSpeed, wallNormal);
				this.finishStampRebound(wallNormal, 0.86, wallImpactSpeed);
			} else {
				this.joltRagdoll(1.1 + wallImpactSpeed * 0.08);
				this.squash = Math.max(this.squash, 0.45);
				this.cameraShake = Math.max(this.cameraShake, 0.18);
			}
		}

		const overToiletHole = this.isAtToiletHole();
		const overKitchenHatch = this.isAtKitchenHatch();
		const topToiletOpening =
			!this.playerInBasement &&
			!this.playerInSewer &&
			this.playerLeftRoom === 'bathroom' &&
			overToiletHole;
		const topHatchOpening =
			!this.playerInBasement && !this.playerInSewer && this.playerInKitchen && overKitchenHatch;
		const basementHatchOpening = this.playerInBasement && overKitchenHatch;

		if (topToiletOpening && this.player.position.y < -0.65) {
			this.playerInSewer = true;
			this.playerOutside = false;
			this.playerInKitchen = false;
			this.playerLeftRoom = null;
			this.player.position.set(TOILET_X, SEWER_FLOOR_Y + 0.18, SEWER_CENTER_Z);
			this.velocity.set(4.8, 2.6, 0);
			this.syncBiomeState();
			this.callbacks.onFeedback('HET DONKERE RIOOL IN. DE VILLA IS VER WEG!');
		} else if (topHatchOpening && this.player.position.y < -0.65) {
			this.playerInBasement = true;
			this.playerOutside = false;
			this.playerInKitchen = false;
			this.playerLeftRoom = null;
			this.basementEntryCooldown = 0.85;
			this.velocity.x = Math.min(this.velocity.x, -2.4);
			this.syncBiomeState();
			this.callbacks.onFeedback('DE KELDER IN!');
		} else if (this.playerInBasement) {
			if (this.player.position.y + PLAYER_HEIGHT >= -0.08) {
				if (
					basementHatchOpening &&
					this.basementEntryCooldown <= 0 &&
					this.player.position.y > -0.2
				) {
					this.playerInBasement = false;
					this.playerInKitchen = true;
					this.syncBiomeState();
					this.callbacks.onFeedback('TERUG NAAR BOVEN!');
				} else if (
					basementHatchOpening &&
					this.basementEntryCooldown > 0 &&
					this.player.position.y > -0.2
				) {
					this.player.position.y = -0.2;
					this.velocity.y = -Math.abs(this.velocity.y) * 0.45;
				} else if (!basementHatchOpening) {
					this.player.position.y = -PLAYER_HEIGHT - 0.08;
					this.velocity.y = -Math.abs(this.velocity.y) * 0.68;
					this.joltRagdoll(1.2);
					this.squash = Math.max(this.squash, 0.5);
				}
			}
		} else if (this.playerInSewer) {
			const inToiletShaft =
				this.toiletHoleOpen && Math.abs(this.player.position.x - TOILET_X) < SEWER_SHAFT_HALF_WIDTH;
			if (inToiletShaft && this.player.position.y > -0.28) {
				this.playerInSewer = false;
				this.playerLeftRoom = 'bathroom';
				this.player.position.set(TOILET_X, 0.03, TOILET_Z);
				this.velocity.y = Math.max(5.2, this.velocity.y);
				this.syncBiomeState();
				this.callbacks.onFeedback('DOOR DE WC WEER OMHOOG!');
			} else if (this.player.position.y + PLAYER_HEIGHT >= SEWER_CEILING_Y && !inToiletShaft) {
				this.player.position.y = SEWER_CEILING_Y - PLAYER_HEIGHT;
				this.velocity.y = -Math.abs(this.velocity.y) * 0.68;
				this.joltRagdoll(1.2);
				this.squash = Math.max(this.squash, 0.5);
			} else if (inToiletShaft && this.player.position.y + PLAYER_HEIGHT >= SEWER_CEILING_Y) {
				this.player.position.x = THREE.MathUtils.clamp(
					this.player.position.x,
					TOILET_X - SEWER_SHAFT_HALF_WIDTH + 0.08,
					TOILET_X + SEWER_SHAFT_HALF_WIDTH - 0.08
				);
			}
		}

		if (
			!this.playerOutside &&
			!this.playerInBasement &&
			!this.playerInSewer &&
			!this.playerUpstairs &&
			this.playerLeftRoom !== 'stairs' &&
			this.player.position.y + PLAYER_HEIGHT >= ROOM_HEIGHT
		) {
			this.player.position.y = ROOM_HEIGHT - PLAYER_HEIGHT;
			this.velocity.y = -Math.abs(this.velocity.y) * 0.82;
			this.joltRagdoll(1.5);
			this.cameraShake = Math.max(this.cameraShake, 0.3);
			this.squash = 0.72;
			this.playSound('wall');
		}
		if (
			this.playerUpstairs &&
			this.player.position.y + PLAYER_HEIGHT >= UPSTAIRS_FLOOR_Y + ROOM_HEIGHT
		) {
			this.player.position.y = UPSTAIRS_FLOOR_Y + ROOM_HEIGHT - PLAYER_HEIGHT;
			this.velocity.y = -Math.abs(this.velocity.y) * 0.82;
			this.joltRagdoll(1.5);
			this.cameraShake = Math.max(this.cameraShake, 0.3);
			this.squash = 0.72;
		}

		if (this.playerInSewer) this.resolveSewerObstacleCollisions();
		const floorHeight = this.getActiveFloorHeight();
		const canFallThroughLevel = topToiletOpening || topHatchOpening;
		if (!canFallThroughLevel && this.player.position.y <= floorHeight) {
			const impactSpeed = Math.abs(this.velocity.y);
			const stampImpactSpeed = this.velocity.length();
			const floorNormal = new THREE.Vector3(0, 1, 0);
			this.player.position.y = floorHeight;
			if (this.isTargetStampSurface(floorNormal) && stampImpactSpeed > 2.8) {
				this.performGroundStamp(stampImpactSpeed);
				this.finishStampRebound(floorNormal, 0.7, stampImpactSpeed);
			} else {
				this.velocity.y = Math.max(5.2, impactSpeed * 0.38);
				this.squash = Math.min(0.82, impactSpeed / 17);
				this.joltArms(1.05 + Math.min(impactSpeed, 12) * 0.08);
				this.playSound('bounce');
			}
		}
	}

	private resolveSewerObstacleCollisions() {
		for (const obstacle of this.sewerObstacles) {
			const playerLeft = this.player.position.x - PLAYER_RADIUS;
			const playerRight = this.player.position.x + PLAYER_RADIUS;
			const playerBottom = this.player.position.y;
			const playerTop = this.player.position.y + PLAYER_HEIGHT;
			if (
				playerRight <= obstacle.minX ||
				playerLeft >= obstacle.maxX ||
				playerTop <= obstacle.minY ||
				playerBottom >= obstacle.maxY
			) {
				continue;
			}

			const candidates = [
				{ depth: playerRight - obstacle.minX, normal: new THREE.Vector3(-1, 0, 0) },
				{ depth: obstacle.maxX - playerLeft, normal: new THREE.Vector3(1, 0, 0) },
				{ depth: playerTop - obstacle.minY, normal: new THREE.Vector3(0, -1, 0) },
				{ depth: obstacle.maxY - playerBottom, normal: new THREE.Vector3(0, 1, 0) }
			];
			candidates.sort((a, b) => a.depth - b.depth);
			const collision = candidates[0];
			const normal = collision.normal;

			if (normal.x < 0) this.player.position.x = obstacle.minX - PLAYER_RADIUS;
			else if (normal.x > 0) this.player.position.x = obstacle.maxX + PLAYER_RADIUS;
			else if (normal.y < 0) this.player.position.y = obstacle.minY - PLAYER_HEIGHT;
			else this.player.position.y = obstacle.maxY;

			const impactSpeed = Math.abs(this.velocity.dot(normal));
			if (this.isTargetStampSurface(normal) && this.velocity.length() > 2.8) {
				if (normal.y > 0.5) this.performGroundStamp(this.velocity.length());
				else this.performWallStamp(this.velocity.length(), normal);
				this.finishStampRebound(normal, 0.74, this.velocity.length());
			} else {
				const incomingSpeed = this.velocity.dot(normal);
				if (incomingSpeed < 0) this.velocity.addScaledVector(normal, -1.72 * incomingSpeed);
				this.joltRagdoll(1.1 + impactSpeed * 0.08);
				this.squash = Math.max(this.squash, 0.48);
			}
			break;
		}
	}

	private updateDoor(delta: number) {
		const target = this.doorOpen ? 1 : 0;
		this.doorOpenAmount = this.reducedMotion
			? target
			: THREE.MathUtils.lerp(this.doorOpenAmount, target, 1 - Math.exp(-8 * delta));
		this.doorPivot.rotation.y = 0;
		this.doorLeafRoot.rotation.x = 0;
		this.doorLeafRoot.rotation.z = (this.doorOpenAmount * -Math.PI) / 2;
		this.doorLeafRoot.position.y = this.doorOpenAmount * 0.045;
		for (const door of this.leftRoomDoors) {
			const doorTarget = door.open ? 1 : 0;
			door.openAmount = this.reducedMotion
				? doorTarget
				: THREE.MathUtils.lerp(door.openAmount, doorTarget, 1 - Math.exp(-8 * delta));
			if (door.room === 'stairs') {
				door.pivot.rotation.y = 0;
				door.leafRoot.rotation.set(0, 0, door.openAmount * STAIR_DOOR_REST_ANGLE);
				door.leafRoot.position.y = door.openAmount * STAIR_DOOR_REST_LIFT;
			} else {
				door.pivot.rotation.y = (door.openAmount * -Math.PI) / 2;
				door.leafRoot.rotation.set(0, 0, 0);
				door.leafRoot.position.y = 0;
			}
		}

		this.lockedBackDoorHit = Math.max(0, this.lockedBackDoorHit - delta * 2.8);
		const lockRattle = this.reducedMotion
			? 0
			: Math.sin((1 - this.lockedBackDoorHit) * 44) * this.lockedBackDoorHit;
		this.lockedBackDoorLeafRoot.position.x = KITCHEN_BACK_DOOR_X + lockRattle * 0.035;
		this.lockedBackDoorLeafRoot.rotation.z = lockRattle * 0.018;
	}

	private getLeftRoomZBounds(room: LeftRoomName) {
		if (room === 'bathroom') return { minZ: BACK_WALL_Z, maxZ: BATHROOM_MAX_Z };
		if (room === 'stairs') return { minZ: BATHROOM_MAX_Z, maxZ: BEDROOM_MIN_Z };
		return { minZ: BEDROOM_MIN_Z, maxZ: ROOM_DEPTH / 2 };
	}

	private getActiveFloorHeight() {
		if (this.playerInSewer) return SEWER_FLOOR_Y;
		if (this.playerInBasement) {
			return this.getBasementStairFloorHeight() ?? BASEMENT_FLOOR_Y;
		}
		if (this.playerUpstairs) return UPSTAIRS_FLOOR_Y;
		if (this.playerLeftRoom !== 'stairs') return 0;
		const stepIndex = THREE.MathUtils.clamp(
			Math.floor((-this.player.position.x - 7.19) / STAIR_STEP_RUN),
			0,
			STAIR_STRAIGHT_STEP_COUNT - 1
		);
		if (this.player.position.x <= STAIR_TOP_X) {
			if (this.player.position.z <= STAIR_TURN_STEP_TWO_Z) return UPSTAIRS_FLOOR_Y;
			if (this.player.position.z <= STAIR_TURN_STEP_ONE_Z) {
				return STAIR_STEP_RISE * (STAIR_STRAIGHT_STEP_COUNT + 1);
			}
		}
		return (stepIndex + 1) * STAIR_STEP_RISE;
	}

	private getBasementStairFloorHeight() {
		if (Math.abs(this.player.position.z - KITCHEN_HATCH_Z) > BASEMENT_STAIR_WIDTH / 2) {
			return null;
		}
		const stairMinX = BASEMENT_STAIR_BOTTOM_X - BASEMENT_STAIR_RUN / 2;
		const stairMaxX = KITCHEN_HATCH_X + BASEMENT_STAIR_RUN / 2;
		if (this.player.position.x < stairMinX || this.player.position.x > stairMaxX) return null;
		const stepIndex = THREE.MathUtils.clamp(
			Math.floor((this.player.position.x - stairMinX) / BASEMENT_STAIR_RUN),
			0,
			BASEMENT_STAIR_STEP_COUNT - 1
		);
		return BASEMENT_FLOOR_Y + (stepIndex + 1) * BASEMENT_STAIR_RISE;
	}

	private isAtToiletHole() {
		return (
			this.toiletHoleOpen &&
			Math.hypot(this.player.position.x - TOILET_X, this.player.position.z - TOILET_Z) <
				TOILET_HOLE_RADIUS - 0.08
		);
	}

	private isAtKitchenHatch() {
		return (
			this.kitchenHatchOpen &&
			Math.abs(this.player.position.x - KITCHEN_HATCH_X) < KITCHEN_HATCH_WIDTH / 2 - 0.08 &&
			Math.abs(this.player.position.z - KITCHEN_HATCH_Z) < KITCHEN_HATCH_DEPTH / 2 - 0.08
		);
	}

	private getActiveBiome(): BiomeName {
		if (this.playerInSewer) return 'sewer';
		if (this.playerInBasement) return 'basement';
		return 'ground';
	}

	private isBreakableActive(breakable: Breakable) {
		return breakable.biome === this.getActiveBiome();
	}

	private isObjectVisibleInScene(object: THREE.Object3D) {
		let current: THREE.Object3D | null = object;
		while (current) {
			if (!current.visible) return false;
			current = current.parent;
		}
		return true;
	}

	private syncBiomeState(force = false) {
		const biome = this.getActiveBiome();
		if (!force && biome === this.activeBiome) return;
		this.activeBiome = biome;
		this.basementRoot.visible = biome === 'basement';
		this.sewerRoot.visible = biome === 'sewer';

		for (const breakable of this.breakables) {
			const sinkingToilet = breakable === this.toiletBreakable && this.toiletSinking;
			breakable.group.visible = breakable.biome === biome && (!breakable.broken || sinkingToilet);
		}

		const palette =
			biome === 'ground'
				? { color: 0xc9d8d1, near: 13, far: 27, exposure: 1.05 }
				: biome === 'basement'
					? { color: 0x382d24, near: 6.5, far: 20, exposure: 0.9 }
					: { color: 0x07100d, near: 3.8, far: 14, exposure: 0.72 };
		this.scene.background = new THREE.Color(palette.color);
		if (this.scene.fog instanceof THREE.Fog) {
			this.scene.fog.color.setHex(palette.color);
			this.scene.fog.near = palette.near;
			this.scene.fog.far = palette.far;
		} else {
			this.scene.fog = new THREE.Fog(palette.color, palette.near, palette.far);
		}
		this.renderer.toneMappingExposure = palette.exposure;

		if (this.groundHemisphere) {
			this.groundHemisphere.intensity =
				biome === 'ground' ? 2.1 : biome === 'basement' ? 0.34 : 0.1;
		}
		if (this.groundSun) {
			this.groundSun.intensity = biome === 'ground' ? 3.2 : biome === 'basement' ? 0.1 : 0;
		}
		if (this.groundWindowGlow) this.groundWindowGlow.intensity = biome === 'ground' ? 28 : 0;
		const basementIntensities = biome === 'basement' ? [10, 7] : [0, 0];
		for (let index = 0; index < this.basementLights.length; index += 1) {
			this.basementLights[index].intensity = basementIntensities[index];
		}
		this.sewerLight.intensity = biome === 'sewer' ? 8.5 : 0;
	}

	private isInsideLeftDoorTarget(door: LeftRoomDoor) {
		const centerY = this.player.position.y + PLAYER_HEIGHT / 2;
		return (
			Math.abs(this.player.position.z - door.centerZ) <= door.width / 2 + 0.16 &&
			centerY <= door.height + 0.18
		);
	}

	private isInsideLeftDoorPassage(door: LeftRoomDoor) {
		return (
			Math.abs(this.player.position.z - door.centerZ) <= door.width / 2 - 0.12 &&
			this.player.position.y + PLAYER_HEIGHT <= door.height + 0.12
		);
	}

	private performLeftDoorStamp(door: LeftRoomDoor, speed: number) {
		this.breakContacts(0.16);
		door.open = true;
		door.damage.visible = true;
		const revealMask = this.leftRoomRevealMasks.get(door.room);
		if (revealMask) revealMask.visible = false;
		this.setLeftRoomDoorCollisionEnabled(door, false);
		this.playerOutside = false;
		this.playerInKitchen = false;
		this.playerLeftRoom = door.room;
		this.player.position.x = LEFT_ROOMS_MAX_X - PLAYER_RADIUS - 0.16;
		this.player.position.z = THREE.MathUtils.clamp(
			this.player.position.z,
			door.centerZ - 0.4,
			door.centerZ + 0.4
		);
		const throughDoor = this.stampDirection.clone();
		throughDoor.x = Math.min(-0.62, throughDoor.x);
		throughDoor.normalize();
		this.velocity.copy(throughDoor).multiplyScalar(Math.max(8.4, speed * 0.64));
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 0.9);
		this.playImpactSample(Math.min(1, speed / 7));
		this.cancelStamp();
		this.joltRagdoll(2.5);
		this.callbacks.onFeedback(
			door.room === 'stairs' ? 'DEUR OPEN! TRAP OMHOOG!' : `DEUR OPEN! ${door.label} IN!`
		);
		this.emitHud(true);
	}

	private setLeftRoomDoorCollisionEnabled(door: LeftRoomDoor, enabled: boolean) {
		for (const surface of door.surfaces) {
			if (enabled) {
				this.stampSurfaceKinds.set(surface, 'wall');
				if (!this.bulletImpactSurfaces.includes(surface)) this.bulletImpactSurfaces.push(surface);
			} else {
				this.stampSurfaceKinds.delete(surface);
				this.bulletImpactSurfaces = this.bulletImpactSurfaces.filter((item) => item !== surface);
			}
		}
	}

	private isInsideDoorTarget() {
		const centerY = this.player.position.y + PLAYER_HEIGHT / 2;
		return (
			Math.abs(this.player.position.z - DOOR_CENTER_Z) <= DOOR_WIDTH / 2 + 0.16 &&
			centerY <= DOOR_HEIGHT + 0.18
		);
	}

	private isInsideDoorPassage() {
		return (
			Math.abs(this.player.position.z - DOOR_CENTER_Z) <= DOOR_WIDTH / 2 - 0.12 &&
			this.player.position.y + PLAYER_HEIGHT <= DOOR_HEIGHT + 0.12
		);
	}

	private isInsideLockedBackDoorTarget() {
		const centerY = this.player.position.y + PLAYER_HEIGHT / 2;
		return (
			Math.abs(this.player.position.x - KITCHEN_BACK_DOOR_X) <=
				KITCHEN_BACK_DOOR_WIDTH / 2 + 0.18 && centerY <= KITCHEN_BACK_DOOR_HEIGHT + 0.16
		);
	}

	private performLockedBackDoorStamp(speed: number, wallNormal: THREE.Vector3) {
		this.lockedBackDoorHit = 1;
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 1.02);
		this.playImpactSample(Math.min(1, speed / 7));
		this.finishStampRebound(wallNormal, 0.82, speed);
		this.joltRagdoll(2.6);
		this.callbacks.onFeedback('VEEL TE VEEL DIKKE SLOTEN!');
	}

	private performDoorStamp(speed: number) {
		this.breakContacts(0.16);
		this.doorOpen = true;
		this.doorDamage.visible = true;
		this.kitchenRevealMask.visible = false;
		this.setDoorCollisionEnabled(false);
		this.playerOutside = false;
		this.playerLeftRoom = null;
		this.playerInKitchen = true;
		this.player.position.x = KITCHEN_MIN_X + PLAYER_RADIUS + 0.16;
		this.player.position.z = THREE.MathUtils.clamp(
			this.player.position.z,
			DOOR_CENTER_Z - 0.48,
			DOOR_CENTER_Z + 0.48
		);
		const throughDoor = this.stampDirection.clone();
		throughDoor.x = Math.max(0.62, throughDoor.x);
		throughDoor.normalize();
		this.velocity.copy(throughDoor).multiplyScalar(Math.max(8.4, speed * 0.64));
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 0.9);
		this.playImpactSample(Math.min(1, speed / 7));
		this.cancelStamp();
		this.joltRagdoll(2.5);
		this.callbacks.onFeedback('DEUR OPEN! KEUKEN IN!');
		this.emitHud(true);
	}

	private setDoorCollisionEnabled(enabled: boolean) {
		for (const surface of this.doorStampSurfaces) {
			if (enabled) {
				this.stampSurfaceKinds.set(surface, 'wall');
				if (!this.bulletImpactSurfaces.includes(surface)) this.bulletImpactSurfaces.push(surface);
			} else {
				this.stampSurfaceKinds.delete(surface);
				this.bulletImpactSurfaces = this.bulletImpactSurfaces.filter((item) => item !== surface);
			}
		}
	}

	private isInsideWindowTarget() {
		const centerY = this.player.position.y + PLAYER_HEIGHT / 2;
		return (
			Math.abs(this.player.position.x - WINDOW_CENTER_X) <= WINDOW_WIDTH / 2 + 0.18 &&
			Math.abs(centerY - WINDOW_CENTER_Y) <= WINDOW_HEIGHT / 2 + 0.18
		);
	}

	private isInsideWindowPassage() {
		const centerY = this.player.position.y + PLAYER_HEIGHT / 2;
		return (
			Math.abs(this.player.position.x - WINDOW_CENTER_X) <= WINDOW_OPENING_WIDTH / 2 - 0.12 &&
			Math.abs(centerY - WINDOW_CENTER_Y) <= WINDOW_OPENING_HEIGHT / 2 - 0.12
		);
	}

	private performWindowStamp(speed: number, wallNormal: THREE.Vector3) {
		this.breakContacts(0.16);
		this.spawnSurfaceCrack(wallNormal, speed, true);
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 0.92);
		this.playImpactSample(Math.min(1, speed / 7));
		this.windowHits += 1;
		if (this.windowHits < WINDOW_STAMPS_REQUIRED) return false;

		this.windowBroken = true;
		this.windowBreakaway.visible = false;
		this.setWindowCollisionEnabled(false);
		this.clearWindowCracks();
		this.clearWindowBulletHoles();
		this.spawnWindowDebris();
		this.playVaseBreakSample();
		this.player.position.x = THREE.MathUtils.clamp(
			this.player.position.x,
			WINDOW_CENTER_X - 0.72,
			WINDOW_CENTER_X + 0.72
		);
		this.player.position.z = BACK_WALL_Z - PLAYER_RADIUS - 0.16;
		this.playerOutside = true;
		const throughWindow = this.stampDirection.clone();
		throughWindow.z = Math.min(-0.55, throughWindow.z);
		throughWindow.normalize();
		this.velocity.copy(throughWindow).multiplyScalar(Math.max(9.5, speed * 0.68));
		this.cancelStamp();
		this.joltRagdoll(2.8);
		this.callbacks.onFeedback('RAAM ERAF! DE TUIN IN!');
		this.emitHud(true);
		return true;
	}

	private setWindowCollisionEnabled(enabled: boolean) {
		for (const surface of this.windowStampSurfaces) {
			if (enabled) {
				this.stampSurfaceKinds.set(surface, 'wall');
				if (!this.bulletImpactSurfaces.includes(surface)) this.bulletImpactSurfaces.push(surface);
			} else {
				this.stampSurfaceKinds.delete(surface);
				this.bulletImpactSurfaces = this.bulletImpactSurfaces.filter((item) => item !== surface);
			}
		}
	}

	private clearWindowCracks() {
		for (let index = this.surfaceCracks.length - 1; index >= 0; index -= 1) {
			const crack = this.surfaceCracks[index];
			if (
				Math.abs(crack.mesh.position.x - WINDOW_CENTER_X) > WINDOW_WIDTH / 2 + 0.35 ||
				Math.abs(crack.mesh.position.z - BACK_WALL_Z) > 0.35
			) {
				continue;
			}
			this.scene.remove(crack.mesh);
			crack.mesh.geometry.dispose();
			crack.mesh.material.dispose();
			crack.texture.dispose();
			this.surfaceCracks.splice(index, 1);
		}
	}

	private clearWindowBulletHoles() {
		for (let index = this.bulletHoles.length - 1; index >= 0; index -= 1) {
			const hole = this.bulletHoles[index];
			if (
				Math.abs(hole.position.x - WINDOW_CENTER_X) > WINDOW_WIDTH / 2 + 0.2 ||
				Math.abs(hole.position.y - WINDOW_CENTER_Y) > WINDOW_HEIGHT / 2 + 0.2 ||
				Math.abs(hole.position.z - BACK_WALL_Z) > 0.35
			) {
				continue;
			}
			this.scene.remove(hole);
			hole.geometry.dispose();
			hole.material.dispose();
			this.bulletHoles.splice(index, 1);
		}
	}

	private spawnWindowDebris() {
		const pieces = this.reducedMotion ? 8 : 18;
		for (let index = 0; index < pieces; index += 1) {
			const mesh = new THREE.Mesh(
				new THREE.BoxGeometry(0.12 + Math.random() * 0.28, 0.1 + Math.random() * 0.34, 0.025),
				new THREE.MeshStandardMaterial({
					color: 0x9ed4e3,
					roughness: 0.18,
					metalness: 0.08,
					transparent: true,
					opacity: 0.78
				})
			);
			mesh.castShadow = true;
			mesh.position.set(
				WINDOW_CENTER_X + (Math.random() - 0.5) * WINDOW_OPENING_WIDTH,
				WINDOW_CENTER_Y + (Math.random() - 0.5) * WINDOW_OPENING_HEIGHT,
				BACK_WALL_Z + 0.08
			);
			this.scene.add(mesh);
			this.debris.push({
				mesh,
				velocity: new THREE.Vector3(
					(Math.random() - 0.5) * 5,
					1.5 + Math.random() * 5,
					-2.5 - Math.random() * 5
				),
				spin: new THREE.Vector3(
					(Math.random() - 0.5) * 14,
					(Math.random() - 0.5) * 14,
					(Math.random() - 0.5) * 14
				),
				life: 4 + Math.random() * 2
			});
		}
	}

	private resolveBreakables(delta: number) {
		for (const breakable of this.breakables) {
			if (breakable.broken || !this.isBreakableActive(breakable)) continue;
			const dx = this.player.position.x - breakable.group.position.x;
			const dz = this.player.position.z - breakable.group.position.z;
			const minimum = PLAYER_RADIUS + breakable.radius;
			const distance = Math.hypot(dx, dz);
			const objectTop = breakable.group.position.y + breakable.height;
			const playerBottom = this.player.position.y;
			const previousBottom = playerBottom - this.velocity.y * delta;
			const topContactRadius = breakable.radius + PLAYER_RADIUS * 0.56;
			const closeToTop = playerBottom >= objectTop - 0.12;
			const landingOnTop =
				!this.stomping &&
				this.velocity.y <= 0 &&
				distance <= topContactRadius &&
				previousBottom >= objectTop - 0.08 &&
				playerBottom <= objectTop + 0.16;
			if (landingOnTop) {
				this.player.position.y = objectTop;
				this.velocity.y = 0;
				this.squash = Math.max(this.squash, 0.12);
				continue;
			}
			if (!this.stomping && closeToTop) continue;
			const verticalOverlap = this.hasVerticalOverlap(breakable);
			const contactLimit = minimum + (this.stomping ? 0.14 : 0);
			if (!verticalOverlap || distance > contactLimit) continue;
			if (breakable === this.kitchenHatchBreakable) {
				if (this.stomping) this.damageBreakable(breakable, 'stamp');
				continue;
			}

			if (this.stomping) {
				this.damageBreakable(breakable, 'stamp');
				this.velocity.x *= 0.72;
				this.velocity.z *= 0.72;
				continue;
			}

			const nx = distance > 0.001 ? dx / distance : 1;
			const nz = distance > 0.001 ? dz / distance : 0;
			this.player.position.x = breakable.group.position.x + nx * minimum;
			this.player.position.z = breakable.group.position.z + nz * minimum;
			const into = this.velocity.x * nx + this.velocity.z * nz;
			if (into < 0) {
				this.velocity.x -= 1.65 * into * nx;
				this.velocity.z -= 1.65 * into * nz;
			}
		}
	}

	private performGroundStamp(speed: number) {
		this.breakContacts(0.06);
		this.spawnImpactRing(0.78);
		this.spawnSurfaceCrack(new THREE.Vector3(0, 1, 0), speed);
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 0.9);
		this.playImpactSample(Math.min(1, speed / 20));
	}

	private performWallStamp(speed: number, wallNormal: THREE.Vector3) {
		this.breakContacts(0.16);
		this.spawnSurfaceCrack(wallNormal, speed);
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 0.72);
		this.playImpactSample(Math.min(1, speed / 7));
	}

	private finishStampRebound(
		surfaceNormal: THREE.Vector3,
		multiplier: number,
		impactSpeed: number
	) {
		const quality = THREE.MathUtils.smoothstep(impactSpeed, 3.4, 14);
		const rebound = THREE.MathUtils.lerp(5.2, 13.2, Math.pow(quality, 1.18));
		const normal = surfaceNormal.clone().normalize();
		const tangent = this.velocity.clone().projectOnPlane(normal).multiplyScalar(0.18);
		const chaos = new THREE.Vector3(
			(Math.random() - 0.5) * 0.9,
			(Math.random() - 0.5) * 0.9,
			(Math.random() - 0.5) * 0.9
		).projectOnPlane(normal);
		this.velocity
			.copy(normal)
			.multiplyScalar(Math.max(4.8, rebound * multiplier))
			.add(tangent)
			.add(chaos);
		this.cancelStamp();
		this.joltRagdoll(1.15 + quality * 1.5);
		const feedback = this.pendingStampFeedback;
		this.pendingStampFeedback = '';
		if (feedback) this.callbacks.onFeedback(feedback);
		this.emitHud(true);
	}

	private joltRagdoll(power: number) {
		this.joltArms(power);
	}

	private resetArmRagdolls() {
		for (const arm of this.armRagdolls) {
			arm.angle = 0;
			arm.angularVelocity = 0;
			arm.object.quaternion.copy(arm.baseQuaternion);
		}
	}

	private joltArms(power: number) {
		for (const arm of this.armRagdolls) {
			const strength = Math.min(14, power * (3.2 + Math.random() * 2.2));
			const switchPoint = ARM_MAX_ANGLE * (0.46 + Math.random() * 0.18);
			const direction = arm.angle > switchPoint ? -1 : 1;
			arm.angularVelocity = THREE.MathUtils.clamp(
				arm.angularVelocity + strength * direction,
				-14,
				14
			);
		}
	}

	private updateArmRagdolls(delta: number) {
		for (const arm of this.armRagdolls) {
			arm.angularVelocity += -Math.sin(arm.angle) * ARM_GRAVITY * delta;
			arm.angularVelocity *= Math.exp(-ARM_DAMPING * delta);
			arm.angle += arm.angularVelocity * delta;

			if (arm.angle < ARM_MIN_ANGLE) {
				arm.angle = ARM_MIN_ANGLE;
				arm.angularVelocity = Math.abs(arm.angularVelocity) * 0.58;
			} else if (arm.angle > ARM_MAX_ANGLE) {
				arm.angle = ARM_MAX_ANGLE;
				arm.angularVelocity = -Math.abs(arm.angularVelocity) * 0.68;
			}

			this.armRotation.setFromAxisAngle(ARM_AXIS, arm.direction * arm.angle);
			arm.object.quaternion.copy(arm.baseQuaternion).multiply(this.armRotation);
		}
	}

	private firePoopBoost() {
		const fartDirection = new THREE.Vector3(0, -1, 0);
		const buttPosition = this.rabbitTumble.localToWorld(
			new THREE.Vector3(0, -PLAYER_HEIGHT / 2 + 0.09, 0)
		);
		for (let index = 0; index < 4; index += 1) {
			const pellet = shadowMesh(
				new THREE.SphereGeometry(0.08 + Math.random() * 0.035, 8, 6),
				material(index % 2 ? 0x4b3428 : 0x39271f, 0.96)
			);
			pellet.scale.set(1, 0.78 + Math.random() * 0.28, 1);
			pellet.position
				.copy(buttPosition)
				.addScaledVector(fartDirection, 0.05 + Math.random() * 0.12);
			this.scene.add(pellet);
			this.weaponProjectiles.push({
				mesh: pellet,
				velocity: fartDirection
					.clone()
					.multiplyScalar(4.8 + Math.random() * 2.6)
					.add(
						new THREE.Vector3(
							(Math.random() - 0.5) * 1.3,
							(Math.random() - 0.5) * 1.3,
							(Math.random() - 0.5) * 1.3
						)
					),
				life: 3.2 + Math.random() * 1.8,
				kind: 'poop',
				spawnDelay: 0
			});
		}
		while (this.weaponProjectiles.length > 110) {
			const oldest = this.weaponProjectiles.shift();
			if (!oldest) break;
			this.scene.remove(oldest.mesh);
			oldest.mesh.geometry.dispose();
			oldest.mesh.material.dispose();
		}

		this.velocity.addScaledVector(fartDirection, -POOP_BOOST_IMPULSE);
		this.velocity.clampLength(0, POOP_BOOST_MAX_SPEED);
		this.joltRagdoll(1.6);
		this.cameraShake = Math.max(this.cameraShake, 0.18);
		this.playFartSound();
	}

	private tryCatchPoopInToilet(projectile: WeaponProjectile) {
		if (
			projectile.kind !== 'poop' ||
			this.toiletHoleOpen ||
			this.toiletSinking ||
			!this.toiletBreakable ||
			this.toiletBreakable.broken ||
			projectile.velocity.y >= 0
		) {
			return false;
		}

		const dx = projectile.mesh.position.x - TOILET_X;
		const dz = projectile.mesh.position.z - (TOILET_Z + 0.08);
		const insideBowl = Math.hypot(dx, dz) <= TOILET_CATCH_RADIUS;
		const aboveBowl = projectile.mesh.position.y >= 0.43 && projectile.mesh.position.y <= 0.92;
		if (!insideBowl || !aboveBowl) return false;

		this.toiletPoopCount += 1;
		this.addToiletPoop();
		if (this.toiletPoopCount >= TOILET_POOPS_REQUIRED) {
			this.openToiletHole();
		} else if (this.toiletPoopCount % 4 === 0) {
			const remaining = TOILET_POOPS_REQUIRED - this.toiletPoopCount;
			this.callbacks.onFeedback(
				remaining <= 4
					? 'WC BIJNA VOL! NOG EVEN SCHIJTEN!'
					: `WC VULT ZICH! ${this.toiletPoopCount}/${TOILET_POOPS_REQUIRED}`
			);
		}
		return true;
	}

	private addToiletPoop() {
		const poop = shadowMesh(
			new THREE.DodecahedronGeometry(0.075 + Math.random() * 0.025, 0),
			material(Math.random() > 0.45 ? 0x4b3020 : 0x62402a, 0.98)
		);
		const progress = this.toiletPoopCount / TOILET_POOPS_REQUIRED;
		const angle = this.toiletPoopCount * 2.37 + Math.random() * 0.65;
		const radius = Math.sqrt(Math.random()) * (0.12 + progress * 0.08);
		poop.position.set(
			Math.cos(angle) * radius,
			0.02 + progress * 0.16 + Math.random() * 0.035,
			Math.sin(angle) * radius * 0.82
		);
		poop.scale.set(1.08, 0.72 + Math.random() * 0.2, 0.92);
		poop.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
		this.toiletFillRoot.add(poop);
	}

	private openToiletHole() {
		if (this.toiletHoleOpen || !this.toiletBreakable) return;
		this.toiletHoleOpen = true;
		this.toiletSinking = true;
		this.toiletSinkAmount = 0;
		this.toiletHole.visible = true;
		this.breakObject(this.toiletBreakable, 'sink');
		this.cameraShake = Math.max(this.cameraShake, 1.05);
		this.callbacks.onFeedback('WC TE VOL! HET RIOOL GAAT OPEN!');
	}

	private updateToilet(delta: number) {
		if (!this.toiletSinking || !this.toiletBreakable) return;
		this.toiletSinkAmount = Math.min(1, this.toiletSinkAmount + delta / 0.9);
		const eased = 1 - Math.pow(1 - this.toiletSinkAmount, 4);
		this.toiletBreakable.group.position.y = this.toiletBreakable.basePosition.y - eased * 2.35;
		this.toiletBreakable.group.rotation.z = Math.sin(eased * Math.PI) * 0.08;
		if (this.toiletSinkAmount >= 1) {
			this.toiletSinking = false;
			this.toiletBreakable.group.visible = false;
		}
	}

	private firePistol() {
		const origin = this.pistolMuzzle
			? this.pistolMuzzle.getWorldPosition(new THREE.Vector3())
			: this.player.position.clone().add(new THREE.Vector3(0, 0.82, 0));
		const direction = this.pistolMuzzle
			? new THREE.Vector3(0, 0, 1)
					.applyQuaternion(this.pistolMuzzle.getWorldQuaternion(new THREE.Quaternion()))
					.normalize()
			: new THREE.Vector3(0, 0, 1).applyQuaternion(
					this.player.getWorldQuaternion(new THREE.Quaternion())
				);
		this.spawnMuzzleEffects(origin, direction);

		const bullet = shadowMesh(
			new THREE.LatheGeometry(
				[
					new THREE.Vector2(0.022, -0.06),
					new THREE.Vector2(0.025, -0.043),
					new THREE.Vector2(0.025, 0.016),
					new THREE.Vector2(0.019, 0.04),
					new THREE.Vector2(0, 0.06)
				],
				12
			),
			material(0xc78b42, 0.22, 0.72)
		);
		bullet.position.copy(origin).addScaledVector(direction, BULLET_HALF_LENGTH);
		bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

		const barrelLength = this.pistolPivot
			? this.pistolPivot.getWorldPosition(new THREE.Vector3()).distanceTo(origin)
			: BULLET_HALF_LENGTH * 2;
		const probeOrigin = origin.clone().addScaledVector(direction, -barrelLength);
		const probeDistance = barrelLength + BULLET_HALF_LENGTH * 2;
		const immediateSurfaceHit = this.findSurfaceHit(probeOrigin, direction, probeDistance);
		const immediateObjectHit = this.findBreakableHit(probeOrigin, direction, probeDistance);
		if (
			immediateObjectHit &&
			(!immediateSurfaceHit || immediateObjectHit.distance < immediateSurfaceHit.distance)
		) {
			bullet.geometry.dispose();
			bullet.material.dispose();
			this.damageBreakable(immediateObjectHit.breakable, 'bullet');
		} else if (immediateSurfaceHit) {
			bullet.geometry.dispose();
			bullet.material.dispose();
			this.spawnBulletHole(immediateSurfaceHit.point, immediateSurfaceHit.normal);
			this.playBulletImpact();
		} else {
			this.scene.add(bullet);
			this.weaponProjectiles.push({
				mesh: bullet,
				velocity: direction.clone().multiplyScalar(BULLET_SPEED),
				life: BULLET_LIFETIME,
				kind: 'pistol',
				spawnDelay: PISTOL_SPAWN_DELAY
			});
		}

		this.velocity.addScaledVector(direction, -5.8);
		this.velocity.clampLength(0, 17);
		this.joltRagdoll(5.8);
		this.cameraShake = Math.max(this.cameraShake, 0.52);
		this.playGunshot();
	}

	private spawnMuzzleEffects(origin: THREE.Vector3, direction: THREE.Vector3) {
		const flashMaterial = new THREE.MeshBasicMaterial({
			color: 0xffd98a,
			transparent: true,
			opacity: 0.76,
			depthTest: false,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			toneMapped: false
		});
		const flash = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 7), flashMaterial);
		flash.position.copy(origin).addScaledVector(direction, 0.14);
		flash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
		flash.renderOrder = 5;
		this.scene.add(flash);
		this.muzzleEffects.push({
			mesh: flash,
			velocity: direction.clone().multiplyScalar(0.35),
			life: 0.075,
			maxLife: 0.075,
			growth: 0.55,
			opacity: 0.76,
			delay: 0,
			followMuzzleUntilVisible: false
		});

		const flashCore = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: this.getMuzzleGlowTexture(),
				color: 0xffc46b,
				transparent: true,
				opacity: 0.58,
				depthTest: false,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				toneMapped: false
			})
		);
		flashCore.scale.setScalar(0.42);
		flashCore.position.copy(origin).addScaledVector(direction, 0.055);
		flashCore.renderOrder = 6;
		this.scene.add(flashCore);
		this.muzzleEffects.push({
			mesh: flashCore,
			velocity: direction.clone().multiplyScalar(0.18),
			life: 0.095,
			maxLife: 0.095,
			growth: 0.5,
			opacity: 0.58,
			delay: 0,
			followMuzzleUntilVisible: false
		});

		const flashBloom = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: this.getMuzzleGlowTexture(),
				color: 0xffa34d,
				transparent: true,
				opacity: 0.3,
				depthTest: false,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				toneMapped: false
			})
		);
		flashBloom.scale.setScalar(0.72);
		flashBloom.position.copy(origin).addScaledVector(direction, 0.045);
		flashBloom.renderOrder = 5;
		this.scene.add(flashBloom);
		this.muzzleEffects.push({
			mesh: flashBloom,
			velocity: direction.clone().multiplyScalar(0.12),
			life: 0.12,
			maxLife: 0.12,
			growth: 0.85,
			opacity: 0.3,
			delay: 0,
			followMuzzleUntilVisible: false
		});

		const flashLight = new THREE.PointLight(0xffad5c, 105 + Math.random() * 20, 5.2, 2);
		flashLight.position.copy(origin).addScaledVector(direction, 0.045);
		flashLight.castShadow = false;
		this.scene.add(flashLight);
		this.muzzleLightEffects.push({
			light: flashLight,
			life: 0.11,
			maxLife: 0.11,
			intensity: flashLight.intensity
		});

		const smokeSide = new THREE.Vector3(1, 0, 0).applyQuaternion(
			new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
		);
		for (let index = 0; index < 8; index += 1) {
			const size = 0.085 + index * 0.007;
			const smokeMaterial = new THREE.SpriteMaterial({
				map: this.getMuzzleSmokeTexture(),
				color: index % 2 === 0 ? 0xb8b1a8 : 0xc4bdb2,
				transparent: true,
				opacity: 0.16,
				depthTest: false,
				depthWrite: false,
				toneMapped: false
			});
			const smoke = new THREE.Sprite(smokeMaterial);
			smoke.scale.set(size * 1.28, size, 1);
			smoke.position
				.copy(origin)
				.addScaledVector(direction, 0.035)
				.addScaledVector(smokeSide, (Math.random() - 0.5) * 0.025);
			const delay = index * 0.055;
			smoke.visible = delay === 0;
			const velocity = direction
				.clone()
				.multiplyScalar(0.2 + index * 0.025)
				.add(new THREE.Vector3(0, 0.1 + Math.random() * 0.09, 0))
				.addScaledVector(smokeSide, (Math.random() - 0.5) * 0.08);
			this.scene.add(smoke);
			smoke.renderOrder = 4;
			this.muzzleEffects.push({
				mesh: smoke,
				velocity,
				life: 0.9 + index * 0.055,
				maxLife: 0.9 + index * 0.055,
				growth: 0.12,
				opacity: 0.16 - index * 0.006,
				delay,
				followMuzzleUntilVisible: delay > 0
			});
		}
	}

	private getMuzzleGlowTexture() {
		if (this.muzzleGlowTexture) return this.muzzleGlowTexture;
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 64;
		const context = canvas.getContext('2d');
		if (context) {
			const glow = context.createRadialGradient(32, 32, 0, 32, 32, 31);
			glow.addColorStop(0, 'rgba(255, 250, 222, 0.96)');
			glow.addColorStop(0.16, 'rgba(255, 211, 122, 0.72)');
			glow.addColorStop(0.48, 'rgba(255, 145, 60, 0.22)');
			glow.addColorStop(1, 'rgba(255, 116, 32, 0)');
			context.fillStyle = glow;
			context.fillRect(0, 0, canvas.width, canvas.height);
		}
		this.muzzleGlowTexture = new THREE.CanvasTexture(canvas);
		this.muzzleGlowTexture.colorSpace = THREE.SRGBColorSpace;
		return this.muzzleGlowTexture;
	}

	private getMuzzleSmokeTexture() {
		if (this.muzzleSmokeTexture) return this.muzzleSmokeTexture;
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 64;
		const context = canvas.getContext('2d');
		if (context) {
			const smoke = context.createRadialGradient(32, 32, 3, 32, 32, 31);
			smoke.addColorStop(0, 'rgba(224, 219, 209, 0.62)');
			smoke.addColorStop(0.38, 'rgba(181, 177, 169, 0.3)');
			smoke.addColorStop(0.76, 'rgba(126, 126, 121, 0.08)');
			smoke.addColorStop(1, 'rgba(104, 106, 101, 0)');
			context.fillStyle = smoke;
			context.fillRect(0, 0, canvas.width, canvas.height);
		}
		this.muzzleSmokeTexture = new THREE.CanvasTexture(canvas);
		this.muzzleSmokeTexture.colorSpace = THREE.SRGBColorSpace;
		return this.muzzleSmokeTexture;
	}

	private updateMuzzleEffects(delta: number) {
		for (let index = this.muzzleLightEffects.length - 1; index >= 0; index -= 1) {
			const effect = this.muzzleLightEffects[index];
			effect.life -= delta;
			const lifeRatio = Math.max(0, effect.life / effect.maxLife);
			effect.light.intensity = effect.intensity * lifeRatio * lifeRatio;
			if (effect.life <= 0) {
				this.scene.remove(effect.light);
				this.muzzleLightEffects.splice(index, 1);
			}
		}

		for (let index = this.muzzleEffects.length - 1; index >= 0; index -= 1) {
			const effect = this.muzzleEffects[index];
			if (effect.delay > 0) {
				effect.delay -= delta;
				if (effect.followMuzzleUntilVisible && this.pistolMuzzle) {
					this.pistolMuzzle.updateWorldMatrix(true, false);
					effect.mesh.position.copy(
						this.pistolMuzzle.getWorldPosition(this.pistolMuzzleWorldPosition)
					);
				}
				if (effect.delay > 0) continue;
				effect.mesh.visible = true;
			}
			effect.life -= delta;
			effect.mesh.position.addScaledVector(effect.velocity, delta);
			effect.velocity.y += delta * 0.18;
			effect.mesh.scale.addScalar(effect.growth * delta);
			const lifeRatio = Math.max(0, effect.life / effect.maxLife);
			effect.mesh.material.opacity = lifeRatio * effect.opacity;
			if (effect.life <= 0) {
				this.scene.remove(effect.mesh);
				effect.mesh.geometry.dispose();
				effect.mesh.material.dispose();
				this.muzzleEffects.splice(index, 1);
			}
		}
	}

	private findSurfaceHit(origin: THREE.Vector3, direction: THREE.Vector3, distance: number) {
		this.projectileRaycaster.set(origin, direction);
		this.projectileRaycaster.near = 0;
		this.projectileRaycaster.far = distance;
		const hit = this.projectileRaycaster.intersectObjects(
			this.bulletImpactSurfaces.filter((surface) => this.isObjectVisibleInScene(surface)),
			false
		)[0];
		if (!hit?.face) return null;
		const normal = hit.face.normal
			.clone()
			.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
			.normalize();
		return { point: hit.point.clone(), normal, distance: hit.distance };
	}

	private findBreakableHit(origin: THREE.Vector3, direction: THREE.Vector3, distance: number) {
		const ray = new THREE.Ray(origin, direction);
		let nearest: { breakable: Breakable; point: THREE.Vector3; distance: number } | null = null;
		for (const breakable of this.breakables) {
			if (breakable.broken || !this.isBreakableActive(breakable)) continue;
			const hitBox = new THREE.Box3(
				new THREE.Vector3(
					breakable.group.position.x - breakable.radius,
					breakable.group.position.y,
					breakable.group.position.z - breakable.radius
				),
				new THREE.Vector3(
					breakable.group.position.x + breakable.radius,
					breakable.group.position.y + breakable.height,
					breakable.group.position.z + breakable.radius
				)
			);
			const point = ray.intersectBox(hitBox, new THREE.Vector3());
			if (!point) continue;
			const hitDistance = origin.distanceTo(point);
			if (hitDistance > distance || (nearest && hitDistance >= nearest.distance)) continue;
			nearest = { breakable, point, distance: hitDistance };
		}
		return nearest;
	}

	private breakContacts(extraReach: number) {
		for (const breakable of this.breakables) {
			if (
				breakable.broken ||
				!this.isBreakableActive(breakable) ||
				!this.hasVerticalOverlap(breakable)
			)
				continue;
			const dx = this.player.position.x - breakable.group.position.x;
			const dz = this.player.position.z - breakable.group.position.z;
			const contactDistance = PLAYER_RADIUS + breakable.radius + extraReach;
			if (Math.hypot(dx, dz) <= contactDistance) this.damageBreakable(breakable, 'stamp');
		}
	}

	private hasVerticalOverlap(breakable: Breakable) {
		const playerBottom = this.player.position.y;
		const playerTop = playerBottom + PLAYER_HEIGHT;
		const objectBottom = breakable.group.position.y;
		const objectTop = objectBottom + breakable.height;
		return playerTop >= objectBottom - 0.12 && playerBottom <= objectTop + 0.12;
	}

	private damageBreakable(breakable: Breakable, source: 'stamp' | 'bullet') {
		if (breakable.broken) return;
		if (breakable === this.kitchenHatchBreakable) {
			if (source === 'bullet') {
				this.playBulletImpact();
				this.callbacks.onFeedback('DIT LUIK MOET JE STAMPEN!');
				return;
			}
			if (breakable.lastStampSequence === this.stampSequence) return;

			breakable.lastStampSequence = this.stampSequence;
			breakable.stampCount += 1;
			if (breakable.stampCount >= breakable.stampsRequired) {
				this.kitchenHatchOpen = true;
				this.kitchenHatchHole.visible = true;
				this.pendingStampFeedback = 'LUIK KAPOT! KELDER OPEN!';
				this.breakObject(breakable);
			} else {
				this.kitchenHatchDamage.visible = true;
				this.pendingStampFeedback = 'KRAK! NOG 1 STAMP!';
				this.cameraShake = Math.max(this.cameraShake, 0.48);
			}
			return;
		}
		if (breakable === this.toiletBreakable && !this.toiletHoleOpen) {
			if (source === 'stamp') {
				if (breakable.lastStampSequence === this.stampSequence) return;
				breakable.lastStampSequence = this.stampSequence;
				this.pendingStampFeedback = 'DE WC WIL KEUTELS!';
				this.cameraShake = Math.max(this.cameraShake, 0.35);
			} else {
				this.playBulletImpact();
				this.callbacks.onFeedback('NIET SCHIETEN. SCHIJTEN!');
			}
			return;
		}
		if (breakable.stampsRequired <= 1) {
			this.breakObject(breakable);
			return;
		}

		if (source === 'bullet') {
			this.playBulletImpact();
			this.callbacks.onFeedback('DIE BOOM MOET JE STAMPEN!');
			return;
		}
		if (breakable.lastStampSequence === this.stampSequence) return;

		breakable.lastStampSequence = this.stampSequence;
		breakable.stampCount += 1;
		if (breakable.stampCount >= breakable.stampsRequired) {
			this.pendingStampFeedback = 'BOOM OM!';
			this.breakObject(breakable);
			return;
		}

		if (breakable.tiltAxis.lengthSq() === 0) {
			const awayFromRabbit = breakable.group.position.clone().sub(this.player.position).setY(0);
			if (awayFromRabbit.lengthSq() < 0.001) awayFromRabbit.set(1, 0, 0);
			awayFromRabbit.normalize();
			breakable.tiltAxis.set(awayFromRabbit.z, 0, -awayFromRabbit.x).normalize();
		}
		const tiltAngle = breakable.stampCount === 1 ? 0.16 : 0.34;
		this.breakableTilt.setFromAxisAngle(breakable.tiltAxis, tiltAngle);
		breakable.group.quaternion.copy(breakable.baseQuaternion).premultiply(this.breakableTilt);
		const stampsLeft = breakable.stampsRequired - breakable.stampCount;
		this.pendingStampFeedback =
			stampsLeft === 1 ? 'KRAK! NOG 1 STAMP!' : `KRAK! NOG ${stampsLeft} STAMPEN!`;
		this.cameraShake = Math.max(this.cameraShake, 0.42);
	}

	private breakObject(breakable: Breakable, effect: 'smash' | 'sink' = 'smash') {
		if (breakable.broken) return;
		const supportedObject =
			breakable.label === 'TAFEL'
				? this.breakables.find((item) => item.label === 'FRUITSCHAAL' && !item.broken)
				: undefined;
		breakable.broken = true;
		breakable.group.visible = effect === 'sink';
		const points = breakable.value;
		this.score += points;
		this.destroyedCount += 1;
		this.lastHit = breakable.label;
		this.lastValue = points;
		if (effect === 'smash') this.spawnDebris(breakable);
		this.callbacks.onImpact(breakable.label, points);
		this.playBreakSound(breakable.material, breakable.label);
		this.cameraShake = Math.max(this.cameraShake, 0.42);
		this.emitHud(true);
		if (supportedObject) this.breakObject(supportedObject);

		if (this.phase === 'playing' && this.destroyedCount === this.breakables.length) {
			this.phase = 'finished';
			this.weaponHeld = false;
			this.velocity.set(0, 0, 0);
			this.playSound('finish');
			this.emitHud(true);
		}
	}

	private spawnDebris(breakable: Breakable) {
		const pieces = this.reducedMotion ? 5 : 10;
		for (let index = 0; index < pieces; index += 1) {
			const geometry = new THREE.BoxGeometry(
				0.12 + Math.random() * 0.22,
				0.1 + Math.random() * 0.28,
				0.12 + Math.random() * 0.22
			);
			const pieceMaterial = new THREE.MeshStandardMaterial({
				color: breakable.color
					.clone()
					.offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.12),
				roughness: 0.78,
				transparent: true
			});
			const mesh = new THREE.Mesh(geometry, pieceMaterial);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.position
				.copy(breakable.group.position)
				.add(
					new THREE.Vector3(
						(Math.random() - 0.5) * breakable.radius,
						0.25 + Math.random() * breakable.height * 0.7,
						(Math.random() - 0.5) * breakable.radius
					)
				);
			this.scene.add(mesh);
			const away = mesh.position.clone().sub(this.player.position).setY(0).normalize();
			this.debris.push({
				mesh,
				velocity: away
					.multiplyScalar(2.4 + Math.random() * 3.5)
					.add(
						new THREE.Vector3(
							(Math.random() - 0.5) * 2.2,
							3.5 + Math.random() * 5,
							(Math.random() - 0.5) * 2.2
						)
					),
				spin: new THREE.Vector3(
					(Math.random() - 0.5) * 9,
					(Math.random() - 0.5) * 9,
					(Math.random() - 0.5) * 9
				),
				life: 5 + Math.random() * 2
			});
		}
	}

	private updateDebris(delta: number) {
		for (let index = this.debris.length - 1; index >= 0; index -= 1) {
			const piece = this.debris[index];
			piece.life -= delta;
			piece.velocity.y -= 12 * delta;
			piece.mesh.position.addScaledVector(piece.velocity, delta);
			piece.mesh.rotation.x += piece.spin.x * delta;
			piece.mesh.rotation.y += piece.spin.y * delta;
			piece.mesh.rotation.z += piece.spin.z * delta;

			if (piece.mesh.position.y < 0.08) {
				piece.mesh.position.y = 0.08;
				if (piece.velocity.y < 0) piece.velocity.y *= -0.38;
				piece.velocity.x *= 0.9;
				piece.velocity.z *= 0.9;
			}
			const minX = WORLD_MIN_X + 0.1;
			const maxX = WORLD_MAX_X - 0.1;
			const frontZLimit = ROOM_DEPTH / 2 - 0.1;
			const backZLimit = GARDEN_BACK_Z + 0.1;
			if (piece.mesh.position.x < minX || piece.mesh.position.x > maxX) piece.velocity.x *= -0.55;
			if (piece.mesh.position.z > frontZLimit || piece.mesh.position.z < backZLimit) {
				piece.velocity.z *= -0.55;
			}
			piece.mesh.position.x = THREE.MathUtils.clamp(piece.mesh.position.x, minX, maxX);
			piece.mesh.position.z = THREE.MathUtils.clamp(piece.mesh.position.z, backZLimit, frontZLimit);

			if (piece.life < 0.8) piece.mesh.material.opacity = Math.max(0, piece.life / 0.8);
			if (piece.life <= 0) {
				this.scene.remove(piece.mesh);
				piece.mesh.geometry.dispose();
				piece.mesh.material.dispose();
				this.debris.splice(index, 1);
			}
		}
	}

	private updateWeaponProjectiles(delta: number) {
		for (let index = this.weaponProjectiles.length - 1; index >= 0; index -= 1) {
			const projectile = this.weaponProjectiles[index];
			projectile.life -= delta;
			if (projectile.kind === 'pistol') {
				if (projectile.spawnDelay > 0) {
					projectile.spawnDelay = Math.max(0, projectile.spawnDelay - delta);
					continue;
				}
				this.projectileStep.copy(projectile.velocity).multiplyScalar(delta);
				const travelDistance = this.projectileStep.length();
				if (travelDistance > 0) {
					const direction = this.projectileStep.normalize();
					const rayOrigin = projectile.mesh.position
						.clone()
						.addScaledVector(direction, -BULLET_HALF_LENGTH);
					const collisionDistance = travelDistance + BULLET_HALF_LENGTH * 2;
					const surfaceHit = this.findSurfaceHit(rayOrigin, direction, collisionDistance);
					const objectHit = this.findBreakableHit(rayOrigin, direction, collisionDistance);
					if (objectHit && (!surfaceHit || objectHit.distance < surfaceHit.distance)) {
						this.damageBreakable(objectHit.breakable, 'bullet');
						this.removeWeaponProjectile(index);
						continue;
					}
					if (surfaceHit) {
						this.spawnBulletHole(surfaceHit.point, surfaceHit.normal);
						this.playBulletImpact();
						this.removeWeaponProjectile(index);
						continue;
					}
				}
				projectile.mesh.position.addScaledVector(projectile.velocity, delta);
			} else {
				projectile.velocity.y -= 11 * delta;
				projectile.mesh.position.addScaledVector(projectile.velocity, delta);
				projectile.mesh.rotation.x += delta * 5.4;
				projectile.mesh.rotation.z += delta * 3.7;
				if (this.tryCatchPoopInToilet(projectile)) {
					this.removeWeaponProjectile(index);
					continue;
				}

				const projectileFloor = this.playerInSewer
					? SEWER_FLOOR_Y + 0.08
					: this.playerInBasement
						? BASEMENT_FLOOR_Y + 0.08
						: this.playerUpstairs
							? UPSTAIRS_FLOOR_Y + 0.08
							: 0.08;
				if (projectile.mesh.position.y < projectileFloor) {
					projectile.mesh.position.y = projectileFloor;
					if (projectile.velocity.y < 0) projectile.velocity.y *= -0.24;
					projectile.velocity.x *= 0.84;
					projectile.velocity.z *= 0.84;
				}

				const minX = WORLD_MIN_X + 0.08;
				const maxX = WORLD_MAX_X - 0.08;
				const frontZLimit = ROOM_DEPTH / 2 - 0.08;
				const backZLimit = GARDEN_BACK_Z + 0.08;
				if (projectile.mesh.position.x < minX || projectile.mesh.position.x > maxX) {
					projectile.velocity.x *= -0.35;
				}
				if (projectile.mesh.position.z > frontZLimit || projectile.mesh.position.z < backZLimit) {
					projectile.velocity.z *= -0.35;
				}
				projectile.mesh.position.x = THREE.MathUtils.clamp(projectile.mesh.position.x, minX, maxX);
				projectile.mesh.position.z = THREE.MathUtils.clamp(
					projectile.mesh.position.z,
					backZLimit,
					frontZLimit
				);
			}

			if (
				projectile.life <= 0 ||
				projectile.mesh.position.x < WORLD_MIN_X - 0.4 ||
				projectile.mesh.position.x > WORLD_MAX_X + 0.4 ||
				projectile.mesh.position.z > ROOM_DEPTH / 2 + 0.4 ||
				projectile.mesh.position.z < GARDEN_BACK_Z - 0.4 ||
				projectile.mesh.position.y > ROOM_HEIGHT + 8 ||
				projectile.mesh.position.y < SEWER_FLOOR_Y - 0.4
			) {
				this.removeWeaponProjectile(index);
			}
		}
	}

	private removeWeaponProjectile(index: number) {
		const projectile = this.weaponProjectiles[index];
		if (!projectile) return;
		this.scene.remove(projectile.mesh);
		projectile.mesh.geometry.dispose();
		projectile.mesh.material.dispose();
		this.weaponProjectiles.splice(index, 1);
	}

	private spawnBulletHole(point: THREE.Vector3, normal: THREE.Vector3) {
		const hole = new THREE.Mesh(
			new THREE.CircleGeometry(0.048 + Math.random() * 0.014, 9),
			new THREE.MeshBasicMaterial({
				color: 0x2b2421,
				transparent: true,
				opacity: 0.92,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -2
			})
		);
		hole.position.copy(point).addScaledVector(normal, 0.008);
		hole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
		hole.rotateZ(Math.random() * Math.PI * 2);
		this.scene.add(hole);
		this.bulletHoles.push(hole);

		while (this.bulletHoles.length > 120) {
			const oldest = this.bulletHoles.shift();
			if (!oldest) break;
			this.scene.remove(oldest);
			oldest.geometry.dispose();
			oldest.material.dispose();
		}
	}

	private spawnImpactRing(radius: number) {
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: COLORS.cream,
			transparent: true,
			opacity: 0.9,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 48), ringMaterial);
		ring.rotation.x = -Math.PI / 2;
		ring.position.set(
			this.player.position.x,
			this.getActiveFloorHeight() + 0.035,
			this.player.position.z
		);
		ring.scale.setScalar(0.4);
		this.scene.add(ring);
		this.impactRings.push({ mesh: ring, life: Math.max(0.35, radius * 0.19) });
	}

	private spawnSurfaceCrack(surfaceNormal: THREE.Vector3, speed: number, emphasizeWindow = false) {
		const normal = surfaceNormal.clone().normalize();
		if (normal.z < -0.5) return;

		const strength = THREE.MathUtils.smoothstep(speed, 3, 15);
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;
		const context = canvas.getContext('2d');
		if (!context) return;

		const center = {
			x: 128 + (Math.random() - 0.5) * 8,
			y: 128 + (Math.random() - 0.5) * 8
		};
		const paths: Array<Array<{ x: number; y: number }>> = [];
		const branchCount = emphasizeWindow
			? 11 + Math.floor(Math.random() * 3)
			: 4 + Math.floor(strength * 6) + Math.floor(Math.random() * 2);

		for (let branch = 0; branch < branchCount; branch += 1) {
			let angle = (branch / branchCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
			const length = emphasizeWindow
				? 72 + Math.random() * 28
				: 42 + strength * 54 + Math.random() * 22;
			const segmentCount = emphasizeWindow
				? 6 + Math.floor(Math.random() * 3)
				: 4 + Math.floor(strength * 3) + Math.floor(Math.random() * 3);
			const startDistance = emphasizeWindow ? 3 + Math.random() * 4 : 7 + Math.random() * 6;
			const points = [
				{
					x: center.x + Math.cos(angle) * startDistance,
					y: center.y + Math.sin(angle) * startDistance
				}
			];
			let distance = startDistance;

			for (let segment = 0; segment < segmentCount; segment += 1) {
				distance += length / segmentCount;
				angle += (Math.random() - 0.5) * 0.5;
				points.push({
					x: center.x + Math.cos(angle) * distance,
					y: center.y + Math.sin(angle) * distance
				});
			}
			paths.push(points);

			if (points.length > 4 && Math.random() < (emphasizeWindow ? 0.9 : 0.45 + strength * 0.35)) {
				const splitIndex = 2 + Math.floor(Math.random() * (points.length - 3));
				const split = points[splitIndex];
				let splitAngle = Math.atan2(
					points[splitIndex].y - points[splitIndex - 1].y,
					points[splitIndex].x - points[splitIndex - 1].x
				);
				splitAngle += (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.65);
				const splitPoints = [{ ...split }];
				let splitDistance = 0;
				const splitSegments = emphasizeWindow ? 4 : 3;
				for (let segment = 0; segment < splitSegments; segment += 1) {
					splitDistance += length * (0.08 + Math.random() * 0.035);
					splitAngle += (Math.random() - 0.5) * 0.45;
					splitPoints.push({
						x: split.x + Math.cos(splitAngle) * splitDistance,
						y: split.y + Math.sin(splitAngle) * splitDistance
					});
				}
				paths.push(splitPoints);
			}
		}

		if (emphasizeWindow) {
			for (let ring = 0; ring < 3; ring += 1) {
				const radius = 24 + ring * 19 + Math.random() * 5;
				const pieces = 4 + ring;
				const offset = Math.random() * Math.PI * 2;
				for (let piece = 0; piece < pieces; piece += 1) {
					const startAngle = offset + (piece / pieces) * Math.PI * 2;
					const arc = 0.42 + Math.random() * 0.32;
					const ringPoints: Array<{ x: number; y: number }> = [];
					for (let step = 0; step <= 4; step += 1) {
						const angle = startAngle + (step / 4) * arc;
						const wobble = (Math.random() - 0.5) * 4;
						ringPoints.push({
							x: center.x + Math.cos(angle) * (radius + wobble),
							y: center.y + Math.sin(angle) * (radius + wobble)
						});
					}
					paths.push(ringPoints);
				}
			}
		}

		const strokePaths = (color: string, width: number) => {
			context.strokeStyle = color;
			context.lineWidth = width;
			context.lineCap = 'round';
			context.lineJoin = 'round';
			for (const points of paths) {
				context.beginPath();
				context.moveTo(points[0].x, points[0].y);
				for (let index = 1; index < points.length; index += 1) {
					context.lineTo(points[index].x, points[index].y);
				}
				context.stroke();
			}
		};

		strokePaths(
			emphasizeWindow ? 'rgba(246, 250, 244, 0.92)' : 'rgba(246, 237, 220, 0.35)',
			emphasizeWindow ? 7.2 : 4.4 + strength * 2.4
		);
		strokePaths(
			emphasizeWindow ? 'rgba(37, 42, 43, 0.96)' : 'rgba(37, 31, 27, 0.82)',
			emphasizeWindow ? 2.15 : 1.25 + strength
		);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const crack = new THREE.Mesh(
			new THREE.PlaneGeometry(1, 1),
			new THREE.MeshBasicMaterial({
				map: texture,
				transparent: true,
				alphaTest: 0.04,
				side: THREE.DoubleSide,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				toneMapped: false
			})
		);

		const activeFloorY = this.getActiveFloorHeight();
		const activeCeilingY = this.playerInSewer
			? SEWER_FLOOR_Y + 3.95
			: this.playerInBasement
				? -0.3
				: this.playerUpstairs
					? UPSTAIRS_FLOOR_Y + ROOM_HEIGHT - 0.3
					: ROOM_HEIGHT - 0.3;
		const surfacePoint = new THREE.Vector3(
			this.player.position.x,
			THREE.MathUtils.clamp(
				this.player.position.y + PLAYER_HEIGHT / 2,
				activeFloorY + 0.3,
				activeCeilingY
			),
			this.player.position.z
		);
		const leftRoomBounds = this.playerLeftRoom
			? this.getLeftRoomZBounds(this.playerLeftRoom)
			: null;
		const lowerBounds = this.playerInSewer
			? { minX: SEWER_MIN_X, maxX: SEWER_MAX_X, minZ: SEWER_MIN_Z, maxZ: SEWER_MAX_Z }
			: this.playerInBasement
				? {
						minX: BASEMENT_MIN_X,
						maxX: BASEMENT_MAX_X,
						minZ: BACK_WALL_Z,
						maxZ: ROOM_DEPTH / 2
					}
				: this.playerUpstairs
					? {
							minX: UPSTAIRS_MIN_X,
							maxX: UPSTAIRS_MAX_X,
							minZ: BACK_WALL_Z,
							maxZ: ROOM_DEPTH / 2
						}
					: null;
		const activeMinX = lowerBounds
			? lowerBounds.minX
			: this.playerOutside
				? -GARDEN_WIDTH / 2
				: leftRoomBounds
					? LEFT_ROOMS_MIN_X
					: this.playerInKitchen
						? KITCHEN_MIN_X
						: -ROOM_WIDTH / 2;
		const activeMaxX = lowerBounds
			? lowerBounds.maxX
			: this.playerOutside
				? GARDEN_WIDTH / 2
				: leftRoomBounds
					? LEFT_ROOMS_MAX_X
					: this.playerInKitchen
						? KITCHEN_MAX_X
						: ROOM_WIDTH / 2;
		const activeFrontZ = lowerBounds
			? lowerBounds.maxZ
			: this.playerOutside
				? BACK_WALL_Z
				: leftRoomBounds
					? leftRoomBounds.maxZ
					: ROOM_DEPTH / 2;
		const activeBackZ = lowerBounds
			? lowerBounds.minZ
			: this.playerOutside
				? GARDEN_BACK_Z
				: leftRoomBounds
					? leftRoomBounds.minZ
					: BACK_WALL_Z;
		if (emphasizeWindow) {
			surfacePoint.set(
				THREE.MathUtils.clamp(
					this.player.position.x,
					WINDOW_CENTER_X - 0.42,
					WINDOW_CENTER_X + 0.42
				),
				THREE.MathUtils.clamp(
					this.player.position.y + PLAYER_HEIGHT / 2,
					WINDOW_CENTER_Y - 0.28,
					WINDOW_CENTER_Y + 0.28
				),
				BACK_WALL_Z + 0.18 + 0.025
			);
		} else if (normal.y > 0.5) {
			surfacePoint.x = THREE.MathUtils.clamp(surfacePoint.x, activeMinX + 0.2, activeMaxX - 0.2);
			surfacePoint.y = this.getActiveFloorHeight() + 0.024;
			surfacePoint.z = THREE.MathUtils.clamp(surfacePoint.z, activeBackZ + 0.2, activeFrontZ - 0.2);
		} else if (Math.abs(normal.x) > 0.5) {
			const inset = this.playerOutside ? 0.285 : 0.095;
			surfacePoint.x = normal.x > 0 ? activeMinX + inset : activeMaxX - inset;
			surfacePoint.z = THREE.MathUtils.clamp(surfacePoint.z, activeBackZ + 0.2, activeFrontZ - 0.2);
		} else {
			surfacePoint.z = this.playerOutside
				? normal.z > 0
					? GARDEN_BACK_Z + 0.285
					: BACK_WALL_Z - 0.095
				: normal.z > 0
					? activeBackZ + 0.095
					: activeFrontZ - 0.095;
			surfacePoint.x = THREE.MathUtils.clamp(surfacePoint.x, activeMinX + 0.2, activeMaxX - 0.2);
		}

		const crackSize = emphasizeWindow
			? 2.05
			: THREE.MathUtils.lerp(0.62, 1.72, strength) * (0.9 + Math.random() * 0.2);
		crack.scale.setScalar(crackSize);
		crack.position.copy(surfacePoint).addScaledVector(normal, 0.012);
		crack.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
		crack.rotateZ(Math.random() * Math.PI * 2);
		crack.renderOrder = 2;
		this.scene.add(crack);
		this.surfaceCracks.push({ mesh: crack, texture });

		while (this.surfaceCracks.length > 32) {
			const oldest = this.surfaceCracks.shift();
			if (!oldest) break;
			this.scene.remove(oldest.mesh);
			oldest.mesh.geometry.dispose();
			oldest.mesh.material.dispose();
			oldest.texture.dispose();
		}
	}

	private updateImpactRings(delta: number) {
		for (let index = this.impactRings.length - 1; index >= 0; index -= 1) {
			const ring = this.impactRings[index];
			ring.life -= delta;
			ring.mesh.scale.addScalar(delta * 7.5);
			ring.mesh.material.opacity = Math.max(0, ring.life * 1.8);
			if (ring.life <= 0) {
				this.scene.remove(ring.mesh);
				ring.mesh.geometry.dispose();
				ring.mesh.material.dispose();
				this.impactRings.splice(index, 1);
			}
		}
	}

	private updateCamera(delta: number) {
		if (this.playerInSewer) {
			this.cameraDesiredPosition.set(
				this.player.position.x,
				SEWER_FLOOR_Y + 3.55,
				SEWER_CENTER_Z + 8.4
			);
			this.cameraDesiredTarget.set(
				this.player.position.x,
				this.player.position.y + PLAYER_HEIGHT * 0.55,
				SEWER_CENTER_Z
			);
		} else if (this.playerInBasement) {
			const cameraAnchorX = THREE.MathUtils.clamp(
				this.player.position.x,
				BASEMENT_MIN_X + 4,
				BASEMENT_MAX_X - 4
			);
			this.cameraDesiredPosition.set(cameraAnchorX, BASEMENT_FLOOR_Y + 4.6, ROOM_DEPTH / 2 + 4.6);
			this.cameraDesiredTarget.set(
				this.player.position.x,
				this.player.position.y + PLAYER_HEIGHT * 0.5,
				this.player.position.z
			);
		} else if (this.playerUpstairs) {
			this.cameraDesiredPosition.set(
				this.player.position.x * 0.74 + UPSTAIRS_CENTER_X * 0.26,
				UPSTAIRS_FLOOR_Y + 6.1,
				11.2 + this.player.position.z * 0.06
			);
			this.cameraDesiredTarget.set(
				this.player.position.x,
				this.player.position.y + PLAYER_HEIGHT * 0.5,
				this.player.position.z * 0.2
			);
		} else if (this.playerLeftRoom) {
			const bounds = this.getLeftRoomZBounds(this.playerLeftRoom);
			const roomCenterZ = (bounds.minZ + bounds.maxZ) / 2;
			const onStairs = this.playerLeftRoom === 'stairs';
			const roomTargetHeight = this.playerLeftRoom === 'bathroom' ? 1.88 : 1.45;
			this.cameraDesiredPosition.set(
				LEFT_ROOMS_CENTER_X + (this.player.position.x - LEFT_ROOMS_CENTER_X) * 0.14,
				onStairs ? 5.15 + this.player.position.y * 0.62 : 4.05 + this.player.position.y * 0.05,
				bounds.maxZ - 0.34
			);
			this.cameraDesiredTarget.set(
				LEFT_ROOMS_CENTER_X + (this.player.position.x - LEFT_ROOMS_CENTER_X) * 0.42,
				onStairs
					? this.player.position.y + PLAYER_HEIGHT * 0.48
					: roomTargetHeight + this.player.position.y * 0.12,
				roomCenterZ + (this.player.position.z - roomCenterZ) * 0.28
			);
		} else if (this.playerInKitchen) {
			this.cameraDesiredPosition.set(
				KITCHEN_CENTER_X + (this.player.position.x - KITCHEN_CENTER_X) * 0.16,
				6.45 + this.player.position.y * 0.06,
				11.4 + this.player.position.z * 0.05
			);
			this.cameraDesiredTarget.set(
				KITCHEN_CENTER_X + (this.player.position.x - KITCHEN_CENTER_X) * 0.42,
				1.55 + this.player.position.y * 0.12,
				this.player.position.z * 0.18
			);
		} else if (this.playerOutside) {
			this.cameraDesiredPosition.set(
				this.player.position.x * 0.76 + WINDOW_CENTER_X * 0.24,
				6.7 + this.player.position.y * 0.08,
				Math.max(GARDEN_BACK_Z + 0.65, this.player.position.z - 7.4)
			);
			this.cameraDesiredTarget.set(
				this.player.position.x,
				this.player.position.y + PLAYER_HEIGHT * 0.55,
				this.player.position.z + 0.35
			);
		} else {
			this.cameraDesiredPosition.copy(CAMERA_HOME);
			this.cameraDesiredPosition.x += this.player.position.x * 0.14;
			this.cameraDesiredPosition.y += this.player.position.y * 0.06;
			this.cameraDesiredPosition.z += this.player.position.z * 0.05;
			this.cameraDesiredTarget.copy(CAMERA_TARGET);
			this.cameraDesiredTarget.x += this.player.position.x * 0.34;
			this.cameraDesiredTarget.y += this.player.position.y * 0.12;
			this.cameraDesiredTarget.z += this.player.position.z * 0.16;
		}

		const response = 1 - Math.exp(-3.2 * delta);
		this.camera.position.lerp(this.cameraDesiredPosition, response);
		this.cameraLookTarget.lerp(this.cameraDesiredTarget, response);
		if (this.cameraShake > 0) {
			this.cameraShake = Math.max(0, this.cameraShake - delta * 2.8);
			if (!this.reducedMotion) {
				const strength = this.cameraShake * 0.11;
				this.camera.position.add(
					new THREE.Vector3(
						(Math.random() - 0.5) * strength,
						(Math.random() - 0.5) * strength,
						(Math.random() - 0.5) * strength
					)
				);
			}
		}
		this.camera.lookAt(this.cameraLookTarget);
	}

	private resetBreakables() {
		for (const breakable of this.breakables) {
			breakable.broken = false;
			breakable.stampCount = 0;
			breakable.lastStampSequence = -1;
			breakable.group.position.copy(breakable.basePosition);
			breakable.group.quaternion.copy(breakable.baseQuaternion);
			breakable.tiltAxis.set(0, 0, 0);
			breakable.group.visible = true;
		}
		this.windowHits = 0;
		this.windowBroken = false;
		this.doorOpen = false;
		this.doorOpenAmount = 0;
		this.playerOutside = false;
		this.playerInKitchen = false;
		this.playerLeftRoom = null;
		this.playerInBasement = false;
		this.playerInSewer = false;
		this.playerUpstairs = false;
		this.basementEntryCooldown = 0;
		this.toiletHoleOpen = false;
		this.kitchenHatchOpen = false;
		this.toiletSinking = false;
		this.toiletSinkAmount = 0;
		this.toiletPoopCount = 0;
		this.toiletHole.visible = false;
		this.kitchenHatchHole.visible = false;
		this.kitchenHatchDamage.visible = false;
		this.syncBiomeState(true);
		this.syncUpstairsVisibility();
		for (const poop of [...this.toiletFillRoot.children]) {
			this.toiletFillRoot.remove(poop);
			disposeObject(poop);
		}
		this.windowBreakaway.visible = true;
		this.doorPivot.rotation.y = 0;
		this.doorLeafRoot.position.y = 0;
		this.doorLeafRoot.rotation.set(0, 0, 0);
		this.doorDamage.visible = false;
		this.kitchenRevealMask.visible = true;
		for (const mask of this.leftRoomRevealMasks.values()) mask.visible = true;
		this.lockedBackDoorHit = 0;
		this.lockedBackDoorLeafRoot.position.x = KITCHEN_BACK_DOOR_X;
		this.lockedBackDoorLeafRoot.rotation.set(0, 0, 0);
		this.setWindowCollisionEnabled(true);
		this.setDoorCollisionEnabled(true);
		for (const door of this.leftRoomDoors) {
			door.open = false;
			door.openAmount = 0;
			door.pivot.rotation.y = 0;
			door.leafRoot.position.y = 0;
			door.leafRoot.rotation.set(0, 0, 0);
			door.damage.visible = false;
			this.setLeftRoomDoorCollisionEnabled(door, true);
		}
	}

	private clearDebris() {
		for (const piece of this.debris) {
			this.scene.remove(piece.mesh);
			piece.mesh.geometry.dispose();
			piece.mesh.material.dispose();
		}
		this.debris = [];
		for (const ring of this.impactRings) {
			this.scene.remove(ring.mesh);
			ring.mesh.geometry.dispose();
			ring.mesh.material.dispose();
		}
		this.impactRings = [];
	}

	private clearSurfaceCracks() {
		for (const crack of this.surfaceCracks) {
			this.scene.remove(crack.mesh);
			crack.mesh.geometry.dispose();
			crack.mesh.material.dispose();
			crack.texture.dispose();
		}
		this.surfaceCracks = [];
	}

	private clearWeaponProjectiles() {
		for (const projectile of this.weaponProjectiles) {
			this.scene.remove(projectile.mesh);
			projectile.mesh.geometry.dispose();
			projectile.mesh.material.dispose();
		}
		this.weaponProjectiles = [];
	}

	private clearMuzzleEffects() {
		for (const effect of this.muzzleLightEffects) this.scene.remove(effect.light);
		this.muzzleLightEffects = [];
		for (const effect of this.muzzleEffects) {
			this.scene.remove(effect.mesh);
			effect.mesh.geometry.dispose();
			effect.mesh.material.dispose();
		}
		this.muzzleEffects = [];
	}

	private clearBulletHoles() {
		for (const hole of this.bulletHoles) {
			this.scene.remove(hole);
			hole.geometry.dispose();
			hole.material.dispose();
		}
		this.bulletHoles = [];
	}

	private getPointerDirection() {
		this.pointerDirection.set(0, 0, 0);
		if (!this.pointerActive) return this.pointerDirection;

		this.camera.updateMatrixWorld();
		this.rabbitTumble.updateWorldMatrix(true, true);
		this.pointerRaycaster.setFromCamera(this.pointerNdc, this.camera);
		const pointerIsOverRabbit = this.pointerRaycaster
			.intersectObject(this.rabbitTumble, true)
			.some(({ object }) => {
				let current: THREE.Object3D | null = object;
				while (current) {
					if (!current.visible) return false;
					if (current === this.rabbitTumble) return true;
					current = current.parent;
				}
				return false;
			});
		if (pointerIsOverRabbit) {
			return this.pointerDirection;
		}
		if (this.playerInSewer) {
			const sewerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -SEWER_CENTER_Z);
			const sewerHit = this.pointerRaycaster.ray.intersectPlane(sewerPlane, this.pointerWorldPoint);
			if (!sewerHit) return this.pointerDirection;
			this.pointerDirection.set(sewerHit.x - this.player.position.x, 0, 0);
			if (this.pointerDirection.lengthSq() < 0.12) return this.pointerDirection.set(0, 0, 0);
			return this.pointerDirection.normalize();
		}
		this.pointerPlane.constant = -(this.player.position.y + PLAYER_HEIGHT / 2);
		const hit = this.pointerRaycaster.ray.intersectPlane(this.pointerPlane, this.pointerWorldPoint);
		if (!hit) return this.pointerDirection;

		this.pointerDirection.set(hit.x - this.player.position.x, 0, hit.z - this.player.position.z);
		if (this.pointerDirection.lengthSq() < 0.12) return this.pointerDirection.set(0, 0, 0);
		return this.pointerDirection.normalize();
	}

	private raycastStampSurface() {
		this.camera.updateMatrixWorld();
		this.pointerRaycaster.setFromCamera(this.pointerNdc, this.camera);
		const hits = this.pointerRaycaster.intersectObjects(
			[...this.stampSurfaceKinds.keys()].filter((surface) => this.isObjectVisibleInScene(surface)),
			false
		);
		const hit = hits[0];
		if (!hit?.face) return null;
		const kind = this.stampSurfaceKinds.get(hit.object);
		if (!kind) return null;

		const normal = hit.face.normal
			.clone()
			.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
			.normalize();
		return { point: hit.point.clone(), normal, kind, object: hit.object };
	}

	private isTargetStampSurface(surfaceNormal: THREE.Vector3) {
		return this.stomping && this.stampTargetNormal.dot(surfaceNormal) > 0.72;
	}

	private cancelStamp() {
		this.stomping = false;
		this.stompWindup = 0;
		this.stompTimeout = 0;
		this.stampTargetsWindow = false;
		this.stampTargetsDoor = false;
		this.stampTargetLeftDoor = null;
		this.stampPose.identity();
	}

	private resize() {
		const parent = this.canvas.parentElement;
		const width = Math.max(1, parent?.clientWidth ?? window.innerWidth);
		const height = Math.max(1, parent?.clientHeight ?? window.innerHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	private handleKey(event: KeyboardEvent, active: boolean) {
		if (event.code === 'KeyE') {
			event.preventDefault();
			if (active && !event.repeat) this.beginUseWeapon();
			else if (!active) this.endUseWeapon();
			return;
		}
		if (!active || event.repeat) return;
		if (event.code === 'KeyQ') {
			event.preventDefault();
			this.cycleWeapon();
			return;
		}
		if (event.code === 'Escape') {
			this.togglePause();
		}
	}

	private ensureAudio() {
		if (this.muted) return;
		this.audioContext ??= new AudioContext();
		if (this.audioContext.state === 'suspended') void this.audioContext.resume();
	}

	private playFartSound() {
		if (this.muted) return;
		const sample = this.fartSample.cloneNode(true) as HTMLAudioElement;
		sample.volume = 0.82;
		sample.preservesPitch = false;
		sample.playbackRate = THREE.MathUtils.lerp(FART_PITCH_MIN, FART_PITCH_MAX, Math.random());
		const cleanup = () => this.activeSamples.delete(sample);
		sample.addEventListener('ended', cleanup, { once: true });
		this.activeSamples.add(sample);
		void sample.play().catch(cleanup);
	}

	private playGunshot() {
		if (this.muted) return;
		const sample = this.pistolSample.cloneNode(true) as HTMLAudioElement;
		sample.volume = 0.86;
		const cleanup = () => this.activeSamples.delete(sample);
		sample.addEventListener('ended', cleanup, { once: true });
		this.activeSamples.add(sample);
		void sample.play().catch(cleanup);
	}

	private playBulletImpact() {
		if (this.muted) return;
		this.ensureAudio();
		const audio = this.audioContext;
		if (!audio) return;

		const now = audio.currentTime;
		const duration = 0.055;
		const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
		const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
		const data = buffer.getChannelData(0);
		for (let index = 0; index < sampleCount; index += 1) {
			const envelope = 1 - index / sampleCount;
			data[index] = (Math.random() * 2 - 1) * envelope * envelope;
		}

		const noise = audio.createBufferSource();
		const filter = audio.createBiquadFilter();
		const gain = audio.createGain();
		noise.buffer = buffer;
		noise.playbackRate.value = 0.92 + Math.random() * 0.18;
		filter.type = 'highpass';
		filter.frequency.value = 850 + Math.random() * 350;
		gain.gain.setValueAtTime(0.065, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		noise.connect(filter).connect(gain).connect(audio.destination);
		noise.start(now);
		noise.stop(now + duration);

		const click = audio.createOscillator();
		const clickGain = audio.createGain();
		click.type = 'square';
		click.frequency.setValueAtTime(950 + Math.random() * 260, now);
		click.frequency.exponentialRampToValueAtTime(220, now + 0.04);
		clickGain.gain.setValueAtTime(0.025, now);
		clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
		click.connect(clickGain).connect(audio.destination);
		click.start(now);
		click.stop(now + 0.04);
	}

	private playImpactSample(power: number) {
		if (this.muted) return;
		const sample = this.impactSample.cloneNode(true) as HTMLAudioElement;
		sample.volume = THREE.MathUtils.lerp(0.5, 0.88, power);
		sample.playbackRate = THREE.MathUtils.lerp(0.86, 1.04, power);
		const cleanup = () => this.activeSamples.delete(sample);
		sample.addEventListener('ended', cleanup, { once: true });
		this.activeSamples.add(sample);
		void sample.play().catch(cleanup);
	}

	private playVaseBreakSample() {
		if (this.muted) return;
		const sample = this.vaseBreakSample.cloneNode(true) as HTMLAudioElement;
		sample.volume = 0.82;
		sample.playbackRate = 0.94 + Math.random() * 0.1;
		const cleanup = () => this.activeSamples.delete(sample);
		sample.addEventListener('ended', cleanup, { once: true });
		this.activeSamples.add(sample);
		void sample.play().catch(cleanup);
	}

	private playChairBreakSample() {
		if (this.muted) return;
		const sample = this.chairBreakSample.cloneNode(true) as HTMLAudioElement;
		sample.volume = 0.72;
		sample.playbackRate = 0.97 + Math.random() * 0.06;
		const cleanup = () => this.activeSamples.delete(sample);
		sample.addEventListener('ended', cleanup, { once: true });
		this.activeSamples.add(sample);
		void sample.play().catch(cleanup);
	}

	private playBreakSound(kind: BreakMaterial, label: string) {
		if (this.muted) return;
		if (label === 'STOEL' || label === 'TUINSTOEL' || label === 'BOEKENKAST') {
			this.playChairBreakSample();
			return;
		}
		if (kind === 'ceramic') {
			this.playVaseBreakSample();
			return;
		}
		this.ensureAudio();
		const audio = this.audioContext;
		if (!audio) return;
		const profiles = {
			wood: {
				duration: 0.3,
				filter: 720,
				gain: 0.15,
				tones: [105, 168],
				wave: 'triangle'
			},
			metal: {
				duration: 0.7,
				filter: 2100,
				gain: 0.13,
				tones: [410, 735, 1260],
				wave: 'triangle'
			},
			plant: {
				duration: 0.25,
				filter: 1250,
				gain: 0.1,
				tones: [92],
				wave: 'sine'
			},
			electronics: {
				duration: 0.42,
				filter: 2600,
				gain: 0.14,
				tones: [920, 460, 118],
				wave: 'square'
			},
			canvas: {
				duration: 0.34,
				filter: 880,
				gain: 0.11,
				tones: [135],
				wave: 'sawtooth'
			}
		} as const;
		const profile = profiles[kind];
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
		filter.type = kind === 'wood' || kind === 'plant' || kind === 'canvas' ? 'lowpass' : 'bandpass';
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

	private playSound(kind: 'start' | 'bounce' | 'wall' | 'finish') {
		if (this.muted) return;
		this.ensureAudio();
		const audio = this.audioContext;
		if (!audio) return;
		const oscillator = audio.createOscillator();
		const gain = audio.createGain();
		const now = audio.currentTime;
		const settings = {
			start: [260, 520, 0.12, 'sine'],
			bounce: [170, 300, 0.1, 'sine'],
			wall: [115, 78, 0.08, 'triangle'],
			finish: [180, 600, 0.4, 'sine']
		} as const;
		const [from, to, duration, type] = settings[kind];
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(from, now);
		oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
		gain.gain.setValueAtTime(0.07, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		oscillator.connect(gain).connect(audio.destination);
		oscillator.start(now);
		oscillator.stop(now + duration);
	}

	private emitHud(force = false) {
		const state: StampHudState = {
			phase: this.phase,
			paused: this.paused,
			score: this.score,
			destroyed: this.destroyedCount,
			total: this.breakables.length,
			lastHit: this.lastHit,
			lastValue: this.lastValue,
			weapon: this.weapon,
			weaponReady: this.weaponCooldown <= 0
		};
		const signature = JSON.stringify(state);
		if (!force && signature === this.lastHudSignature) return;
		this.lastHudSignature = signature;
		this.callbacks.onHud(state);
	}
}
