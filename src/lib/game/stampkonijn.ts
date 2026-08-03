import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GameEvents } from './core/GameEvents';
import { AudioSystem } from './systems/AudioSystem';
import { WorldLoader, type LoadedWorld } from './world/WorldLoader';
import type {
	BreakMaterial,
	BulletImpactMaterial,
	GameCallbacks,
	GamePhase,
	GunWeapon,
	StampHudState,
	WeaponName
} from './types';

export type { GamePhase, StampHudState, WeaponName } from './types';

type StampSurfaceKind = 'floor' | 'wall';
type LeftRoomName = 'bathroom' | 'stairs' | 'bedroom';
type BiomeName = 'ground' | 'basement' | 'sewer';
type PoopieMonsterState = 'neutral' | 'dead' | 'friend';

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
	floorY: number;
}

interface GarbagePile {
	mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
}

interface ImpactRing {
	mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
	life: number;
}

interface WaterRipple {
	mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
	life: number;
	maxLife: number;
	expansion: number;
}

interface WaterDroplet {
	mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
	velocity: THREE.Vector3;
	life: number;
	maxLife: number;
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
	canFeedPoopieMonster?: boolean;
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
	muzzle?: THREE.Object3D;
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

interface StairStep {
	x: number;
	z: number;
	topY: number;
	length: number;
	width: number;
	rotationY: number;
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
const TOILET_HOLE_VISUAL_RADIUS = TOILET_HOLE_RADIUS + 0.14;
const TOILET_HOLE_EDGE_PROFILE = [
	1.03, 0.91, 1.08, 0.94, 1.01, 0.89, 1.06, 0.95, 1.02, 0.9, 1.07, 0.93, 1.01, 0.88, 1.05, 0.94
];
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
const POOPIE_MONSTER_X = TOILET_X + 4.85;
const POOPIE_MONSTER_RADIUS = 1.04;
const POOPIE_MONSTER_HEIGHT = 2.06;
const POOPIE_MONSTER_HITBOX_TOP_PADDING = 0.12;
const POOPIE_MONSTER_BLOCK_KNOCKBACK = 5.4;
const POOPIE_MONSTER_BULLET_HITS = 3;
const POOPIE_MONSTER_POOP_HITS = 3;
const POOPIE_MONSTER_FEED_DISTANCE = 3;
const POOPIE_MONSTER_FEED_HEIGHT = 0.58;
const POOPIE_MONSTER_SPEECH_RADIUS = 5.4;
const POOPIE_MONSTER_SPEECH_REARM_RADIUS = 7;
const POOPIE_MONSTER_DEATH_TIME_SCALE = 0.28;
const POOPIE_MONSTER_DEATH_DURATION = 0.82;
const POOPIE_MONSTER_DEATH_GROUND_Y = 0.18;
const SEWER_INTRO_DURATION = 4.95;
const SEWER_INTRO_AUDIO_DELAY = 0.48;
const SEWER_INTRO_FOCUS_DURATION = 0.82;
const STAIR_STEP_COUNT = 12;
const STAIR_STEP_RISE = ROOM_HEIGHT / STAIR_STEP_COUNT;
const STAIR_STEP_RUN = 0.45;
const STAIR_DOOR_REST_ANGLE = Math.atan(STAIR_STEP_RUN / STAIR_STEP_RISE);
const STAIR_DOOR_REST_LIFT = 0.12;
const STAIR_BOTTOM_X = -7.46;
const STAIR_TOP_X = STAIR_BOTTOM_X - (STAIR_STEP_COUNT - 1) * STAIR_STEP_RUN;
const STAIR_TOP_Z = 0;
const STAIR_DESCENT_SPAWN_INDEX = Math.floor((STAIR_STEP_COUNT - 1) / 2);
const STAIR_DESCENT_SPAWN_X = STAIR_BOTTOM_X - STAIR_DESCENT_SPAWN_INDEX * STAIR_STEP_RUN;
const STAIR_DESCENT_SPAWN_Y = STAIR_STEP_RISE * (STAIR_DESCENT_SPAWN_INDEX + 1);
const UPSTAIRS_FLOOR_Y = ROOM_HEIGHT;
const UPSTAIRS_MIN_X = LEFT_ROOMS_MIN_X;
const UPSTAIRS_MAX_X = KITCHEN_MAX_X;
const UPSTAIRS_CENTER_X = (UPSTAIRS_MIN_X + UPSTAIRS_MAX_X) / 2;
const UPSTAIRS_STAIRWELL_MIN_X = UPSTAIRS_MIN_X + 0.1;
const UPSTAIRS_STAIRWELL_MAX_X = UPSTAIRS_STAIRWELL_MIN_X + 4;
const UPSTAIRS_STAIRWELL_CENTER_X = (UPSTAIRS_STAIRWELL_MIN_X + UPSTAIRS_STAIRWELL_MAX_X) / 2;
const UPSTAIRS_STAIRWELL_HALF_Z = 1.5;
const UPSTAIRS_LIGHT_INTENSITIES = [13, 9, 7];
const GARDEN_WIDTH = 28;
const GARDEN_DEPTH = 18;
const GARDEN_BACK_Z = BACK_WALL_Z - GARDEN_DEPTH;
const DOGHOUSE_X = 9;
const DOGHOUSE_Z = GARDEN_BACK_Z + 1.45;
const POOL_X = 5.2;
const POOL_Z = -15.1;
const POOL_WATER_Y = 0.62;
const POOL_BOTTOM_Y = 0.09;
const POOL_WATER_RADIUS = 1.86;
const POOL_ENTRY_RADIUS = 1.56;
const WORLD_MIN_X = Math.min(-GARDEN_WIDTH / 2, LEFT_ROOMS_MIN_X, SEWER_MIN_X);
const WORLD_MAX_X = Math.max(KITCHEN_MAX_X, SEWER_MAX_X);
const PLAYER_RADIUS = 0.52;
const PLAYER_HEIGHT = 1.38;
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
	pistol: 0.25,
	g36: 0.095
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

function getToiletHoleEdgePoints(extraRadius = 0) {
	return TOILET_HOLE_EDGE_PROFILE.map((profile, index) => {
		const angle = (index / TOILET_HOLE_EDGE_PROFILE.length) * Math.PI * 2;
		const radius = TOILET_HOLE_VISUAL_RADIUS * profile + extraRadius;
		return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
	});
}

function makeIrregularDiscGeometry(points: THREE.Vector2[]) {
	const positions = [0, 0, 0];
	for (const point of points) positions.push(point.x, 0, point.y);
	const indices: number[] = [];
	for (let index = 0; index < points.length; index += 1) {
		const current = index + 1;
		const next = ((index + 1) % points.length) + 1;
		indices.push(0, next, current);
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

function makeIrregularRingGeometry(innerPoints: THREE.Vector2[], width: number) {
	const positions: number[] = [];
	for (const point of innerPoints) {
		const outer = point.clone().setLength(point.length() + width);
		positions.push(point.x, 0, point.y, outer.x, 0, outer.y);
	}
	const indices: number[] = [];
	for (let index = 0; index < innerPoints.length; index += 1) {
		const inner = index * 2;
		const outer = inner + 1;
		const nextInner = ((index + 1) % innerPoints.length) * 2;
		const nextOuter = nextInner + 1;
		indices.push(inner, nextInner, outer, outer, nextInner, nextOuter);
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

function makeToiletFloorCracks(edgePoints: THREE.Vector2[]) {
	const positions: number[] = [];
	const crackIndices = [0, 2, 4, 7, 9, 11, 13, 15];
	for (const [crackNumber, edgeIndex] of crackIndices.entries()) {
		const edge = edgePoints[edgeIndex];
		const radial = edge.clone().normalize();
		const tangent = new THREE.Vector2(-radial.y, radial.x);
		const first = edge.clone().addScaledVector(radial, 0.17);
		const second = first
			.clone()
			.addScaledVector(radial, 0.22 + (crackNumber % 3) * 0.035)
			.addScaledVector(tangent, crackNumber % 2 === 0 ? 0.07 : -0.065);
		const end = second
			.clone()
			.addScaledVector(radial, 0.22 + (crackNumber % 2) * 0.06)
			.addScaledVector(tangent, crackNumber % 3 === 0 ? -0.05 : 0.045);
		for (const [start, finish] of [
			[edge, first],
			[first, second],
			[second, end]
		] as const) {
			positions.push(start.x, 0, start.y, finish.x, 0, finish.y);
		}
		const branch = second
			.clone()
			.addScaledVector(radial, 0.08)
			.addScaledVector(tangent, crackNumber % 2 === 0 ? -0.16 : 0.16);
		positions.push(second.x, 0, second.y, branch.x, 0, branch.y);
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	return new THREE.LineSegments(
		geometry,
		new THREE.LineBasicMaterial({ color: 0x171512, transparent: true, opacity: 0.92 })
	);
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
	private events = new GameEvents();
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
	private renderer: THREE.WebGLRenderer;
	private timer = new THREE.Timer();
	private loader = new GLTFLoader();
	private worldLoader = new WorldLoader();
	private player = new THREE.Group();
	private rabbitTumble = new THREE.Group();
	private rabbitSquash = new THREE.Group();
	private armRagdolls: ArmRagdoll[] = [];
	private armRotation = new THREE.Quaternion();
	private pistolPivot: THREE.Group | null = null;
	private pistolMuzzle: THREE.Object3D | null = null;
	private muzzleWorldPosition = new THREE.Vector3();
	private g36Pivot: THREE.Group | null = null;
	private g36Muzzle: THREE.Object3D | null = null;
	private g36Unlocked = false;
	private g36PickupAvailable = false;
	private g36Pickup = new THREE.Group();
	private g36PickupRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial> | null = null;
	private g36PickupTime = 0;
	private gunRackBreakable: Breakable | null = null;
	private gunRackDisplayRoot = new THREE.Group();
	private cameraDesiredPosition = CAMERA_HOME.clone();
	private cameraDesiredTarget = CAMERA_TARGET.clone();
	private cameraLookTarget = CAMERA_TARGET.clone();
	private sewerIntroCameraPosition = new THREE.Vector3();
	private sewerIntroCameraTarget = new THREE.Vector3();
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
	private bulletImpactSurfaceMaterials = new Map<THREE.Object3D, BulletImpactMaterial>();
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
	private lastStampImpactSoundSequence = -1;
	private pendingStampFeedback = '';
	private stomping = false;
	private stompWindup = 0;
	private stompTimeout = 0;
	private breakables: Breakable[] = [];
	private breakablesRoot = new THREE.Group();
	private basementRoot: THREE.Object3D = new THREE.Group();
	private sewerRoot: THREE.Object3D = new THREE.Group();
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
	private kitchenInteriorRoot: THREE.Object3D = new THREE.Group();
	private leftRoomInteriorRoots = new Map<LeftRoomName, THREE.Object3D>();
	private playerOutside = false;
	private playerInKitchen = false;
	private playerLeftRoom: LeftRoomName | null = null;
	private leftRoomDoors: LeftRoomDoor[] = [];
	private stairSteps: StairStep[] = [];
	private toiletBreakable: Breakable | null = null;
	private poolBreakable: Breakable | null = null;
	private poolWater: THREE.Mesh<THREE.CircleGeometry, THREE.MeshPhysicalMaterial> | null = null;
	private poolWaterBasePositions: Float32Array | null = null;
	private poolWaterTime = 0;
	private poolWaveEnergy = 0;
	private rabbitInPoolWater = false;
	private poolSplashCooldown = 0;
	private toiletFillRoot = new THREE.Group();
	private toiletPoopCount = 0;
	private toiletSinking = false;
	private toiletSinkAmount = 0;
	private toiletHoleOpen = false;
	private playerInBasement = false;
	private playerInSewer = false;
	private playerUpstairs = false;
	private upstairsRoot: THREE.Object3D = new THREE.Group();
	private upstairsBreakables: Breakable[] = [];
	private toiletHole = new THREE.Group();
	private toiletFloorPlug = new THREE.Group();
	private kitchenHatchBreakable: Breakable | null = null;
	private kitchenHatchDamage = new THREE.Group();
	private kitchenHatchOpen = false;
	private kitchenHatchHole = new THREE.Group();
	private basementEntryCooldown = 0;
	private basementLights: THREE.PointLight[] = [];
	private upstairsLights: THREE.PointLight[] = [];
	private sewerLight = new THREE.PointLight(0xb7cb74, 0, 40, 2);
	private sewerObstacles: SewerObstacle[] = [];
	private poopieMonsterRoot = new THREE.Group();
	private poopieMonsterPose = new THREE.Group();
	private poopieMonsterFacing = new THREE.Group();
	private poopieMonsterHeart: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial> | null =
		null;
	private poopieMonsterWarning: THREE.Sprite | null = null;
	private poopieMonsterStatus: THREE.Sprite | null = null;
	private poopieMonsterStatusTexture: THREE.CanvasTexture | null = null;
	private poopieMonsterIntroLines: THREE.Sprite | null = null;
	private poopieMonsterArms: THREE.Object3D[] = [];
	private poopieMonsterMaterials: THREE.MeshStandardMaterial[] = [];
	private poopieMonsterState: PoopieMonsterState = 'neutral';
	private poopieMonsterHealth = POOPIE_MONSTER_BULLET_HITS;
	private poopieMonsterPoopHits = 0;
	private poopieMonsterTime = 0;
	private poopieMonsterHitFlash = 0;
	private poopieMonsterDeathInProgress = false;
	private poopieMonsterDeathProgress = 0;
	private poopieMonsterDeathStartY = 0;
	private poopieMonsterDeathStartRotation = 0;
	private poopieMonsterDeathStartScale = new THREE.Vector3(1, 1, 1);
	private debris: DebrisPiece[] = [];
	private garbagePiles: GarbagePile[] = [];
	private impactRings: ImpactRing[] = [];
	private waterRipples: WaterRipple[] = [];
	private waterDroplets: WaterDroplet[] = [];
	private surfaceCracks: SurfaceCrack[] = [];
	private weaponProjectiles: WeaponProjectile[] = [];
	private muzzleEffects: MuzzleEffect[] = [];
	private muzzleLightEffects: MuzzleLightEffect[] = [];
	private muzzleLight = new THREE.PointLight(0xffad5c, 0, 5.2, 2);
	private muzzleGlowTexture: THREE.CanvasTexture | null = null;
	private muzzleSmokeTexture: THREE.CanvasTexture | null = null;
	private weaponWarmupRoot: THREE.Group | null = null;
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
	private poopieMonsterSpeechArmed = true;
	private sewerIntroActive = false;
	private sewerIntroPlayed = false;
	private sewerIntroAudioPlayed = false;
	private sewerIntroTime = 0;
	private audio: AudioSystem;
	private keyDownHandler: (event: KeyboardEvent) => void;
	private keyUpHandler: (event: KeyboardEvent) => void;
	private blurHandler: () => void;

	constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
		this.canvas = canvas;
		this.events.on('hud', callbacks.onHud);
		this.events.on('impact', ({ label, value }) => callbacks.onImpact(label, value));
		this.events.on('feedback', ({ message }) => callbacks.onFeedback(message));
		this.events.on('sewerIntro', ({ active }) => callbacks.onSewerIntro(active));
		this.events.on('ready', callbacks.onReady);
		this.events.on('error', ({ message }) => callbacks.onError(message));
		this.audio = new AudioSystem();
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
			await this.loadWorldGeometry();
			this.createRoom();
			this.scene.add(this.breakablesRoot);
			this.createBreakables();
			this.syncUpstairsVisibility();
			this.syncBiomeState(true);
			await Promise.all([this.loadModels(), this.audio.preloadGunshotBuffers()]);

			this.camera.position.copy(CAMERA_HOME);
			this.camera.lookAt(CAMERA_TARGET);
			this.resizeObserver = new ResizeObserver(() => this.resize());
			this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
			window.addEventListener('keydown', this.keyDownHandler, { passive: false });
			window.addEventListener('keyup', this.keyUpHandler, { passive: false });
			window.addEventListener('blur', this.blurHandler);
			this.resize();
			await this.prepareWeaponEffects();
			this.timer.connect(document);
			this.timer.reset();
			this.animate();
			this.emitHud(true);
			this.events.emit('ready', undefined);
		} catch (error) {
			console.error(error);
			this.events.emit('error', {
				message: 'Het konijn kon de kamer niet binnenkomen. Probeer de pagina opnieuw.'
			});
		}
	}

	start() {
		this.audio.reset();
		this.clearDebris();
		this.clearWaterEffects();
		this.clearSurfaceCracks();
		this.clearWeaponProjectiles();
		this.clearMuzzleEffects();
		this.clearBulletHoles();
		this.resetBreakables();
		this.player.position.set(0, 0, 2.4);
		this.player.rotation.set(0, Math.PI, 0);
		this.camera.position.copy(CAMERA_HOME);
		this.cameraLookTarget.copy(CAMERA_TARGET);
		this.camera.lookAt(CAMERA_TARGET);
		this.camera.fov = 46;
		this.camera.updateProjectionMatrix();
		this.rabbitTumble.rotation.set(0, 0, 0);
		this.velocity.set(0, 0, 0);
		this.rabbitInPoolWater = false;
		this.poolSplashCooldown = 0;
		this.poolWaveEnergy = 0;
		this.pointerActive = false;
		this.stomping = false;
		this.stompWindup = 0;
		this.stompTimeout = 0;
		this.stampSequence = 0;
		this.lastStampImpactSoundSequence = -1;
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
		this.audio.playCue('start');
		this.emitHud(true);
	}

	cycleWeapon() {
		if (this.sewerIntroActive) return;
		this.weaponHeld = false;
		const weapons: WeaponName[] = this.g36Unlocked ? ['poop', 'pistol', 'g36'] : ['poop', 'pistol'];
		const currentIndex = Math.max(0, weapons.indexOf(this.weapon));
		this.weapon = weapons[(currentIndex + 1) % weapons.length];
		this.syncWeaponModel();
		this.audio.playWeaponChange();
		this.emitHud(true);
	}

	beginUseWeapon() {
		if (this.phase !== 'playing' || this.paused || this.sewerIntroActive) return;
		this.weaponHeld = true;
		this.useWeapon();
	}

	endUseWeapon() {
		this.weaponHeld = false;
	}

	useWeapon() {
		if (this.phase !== 'playing' || this.paused || this.sewerIntroActive || this.weaponCooldown > 0)
			return;
		this.audio.ensure();
		this.weaponCooldown = WEAPON_COOLDOWNS[this.weapon];
		if (this.weapon === 'poop') this.firePoopBoost();
		else this.fireGun(this.weapon);
		this.emitHud(true);
	}

	setPointerTarget(clientX: number, clientY: number) {
		if (this.sewerIntroActive) return;
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
		if (this.phase !== 'playing' || this.paused || this.sewerIntroActive || this.stomping) return;
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
		this.audio.ensure();
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
		if (this.phase !== 'playing' || this.sewerIntroActive) return;
		this.paused = !this.paused;
		this.emitHud(true);
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		this.audio.setMuted(muted);
	}

	setReducedMotion(reduced: boolean) {
		this.reducedMotion = reduced;
		if (reduced) this.cameraShake = 0;
	}

	destroy() {
		cancelAnimationFrame(this.frame);
		this.events.clear();
		this.timer.dispose();
		this.resizeObserver?.disconnect();
		window.removeEventListener('keydown', this.keyDownHandler);
		window.removeEventListener('keyup', this.keyUpHandler);
		window.removeEventListener('blur', this.blurHandler);
		this.audio.destroy();
		this.clearDebris();
		this.clearWaterEffects();
		this.clearSurfaceCracks();
		this.clearWeaponProjectiles();
		this.clearMuzzleEffects();
		this.disposeWeaponWarmupResources();
		this.muzzleGlowTexture?.dispose();
		this.muzzleGlowTexture = null;
		this.muzzleSmokeTexture?.dispose();
		this.muzzleSmokeTexture = null;
		if (this.poopieMonsterIntroLines) {
			this.poopieMonsterIntroLines.material.map?.dispose();
			this.poopieMonsterIntroLines.material.dispose();
		}
		this.poopieMonsterStatus?.material.dispose();
		this.poopieMonsterStatusTexture?.dispose();
		this.poopieMonsterStatusTexture = null;
		this.clearBulletHoles();
		disposeObject(this.scene);
		this.renderer.dispose();
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

		// Keep the muzzle light in the scene so firing never changes the shader's light count.
		this.muzzleLight.castShadow = false;
		this.scene.add(this.muzzleLight);
	}

	private async loadWorldGeometry() {
		const world = await this.worldLoader.load('/game/levels/stampkonijn-house.level.json');
		this.scene.add(world.root);
		this.kitchenInteriorRoot = this.requireWorldZone(world, 'kitchen');
		this.basementRoot = this.requireWorldZone(world, 'basement');
		this.sewerRoot = this.requireWorldZone(world, 'sewer');
		this.upstairsRoot = this.requireWorldZone(world, 'upstairs');
		this.leftRoomInteriorRoots.clear();
		this.leftRoomInteriorRoots.set('bathroom', this.requireWorldZone(world, 'bathroom'));
		this.leftRoomInteriorRoots.set('stairs', this.requireWorldZone(world, 'stairs'));
		this.leftRoomInteriorRoots.set('bedroom', this.requireWorldZone(world, 'bedroom'));

		world.root.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			child.castShadow = true;
			child.receiveShadow = true;
		});
		world.root.updateMatrixWorld(true);
		this.registerWorldSurfaces(world);
		this.kitchenInteriorRoot.visible = false;
		this.basementRoot.visible = false;
		this.sewerRoot.visible = false;
		this.upstairsRoot.visible = false;
		for (const interior of this.leftRoomInteriorRoots.values()) interior.visible = false;
	}

	private requireWorldZone(world: LoadedWorld, zoneId: string) {
		const zone = world.zones.get(zoneId);
		if (!zone) throw new Error('Missing GLB world zone: ' + zoneId);
		return zone;
	}

	private registerWorldSurfaces(world: LoadedWorld) {
		const impactMaterials = new Set<BulletImpactMaterial>([
			'land',
			'metal',
			'water',
			'wood',
			'body',
			'concrete',
			'glass',
			'grass'
		]);
		this.sewerObstacles = [];

		for (const [colliderId, collider] of world.colliders) {
			if (!(collider instanceof THREE.Mesh)) {
				throw new Error('GLB collider is not a mesh: ' + colliderId);
			}
			this.bulletImpactSurfaces.push(collider);
			const stampSurface = collider.userData.stamp_surface;
			if (stampSurface === 'floor' || stampSurface === 'wall') {
				this.stampSurfaceKinds.set(collider, stampSurface);
			}
			const impactMaterial = collider.userData.impact_material;
			if (
				typeof impactMaterial === 'string' &&
				impactMaterials.has(impactMaterial as BulletImpactMaterial)
			) {
				this.bulletImpactSurfaceMaterials.set(collider, impactMaterial as BulletImpactMaterial);
			}

			if (colliderId.startsWith('sewer_obstacle_')) {
				const bounds = new THREE.Box3().setFromObject(collider);
				this.sewerObstacles.push({
					minX: bounds.min.x,
					maxX: bounds.max.x,
					minY: bounds.min.y,
					maxY: bounds.max.y
				});
			}
		}
	}

	private createRoom() {
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
		this.windowBreakaway.add(
			glass,
			box([0.07, WINDOW_OPENING_HEIGHT, 0.1], [0, 0, 0.06], COLORS.cream),
			box([WINDOW_OPENING_WIDTH, 0.07, 0.1], [0, 0, 0.06], COLORS.cream)
		);
		this.windowBreakaway.position.set(WINDOW_CENTER_X, WINDOW_CENTER_Y, BACK_WALL_Z + 0.18);
		this.windowStampSurfaces = [glass];
		this.setWindowCollisionEnabled(true);
		this.scene.add(this.windowBreakaway);

		this.createLeftRooms();
		this.createKitchen();
		this.createBasement();
		this.createSewer();
		this.createUpstairs();
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

		this.stairSteps = [];
		for (let index = 0; index < STAIR_STEP_COUNT; index += 1) {
			this.stairSteps.push({
				x: STAIR_BOTTOM_X - index * STAIR_STEP_RUN,
				z: STAIR_TOP_Z,
				topY: STAIR_STEP_RISE * (index + 1),
				length: STAIR_STEP_RUN + 0.08,
				width: 2.28,
				rotationY: 0
			});
		}

		const bathroomRoot = this.leftRoomInteriorRoots.get('bathroom');
		if (bathroomRoot) this.createToiletRoomDecor(bathroomRoot);
		for (const config of doorConfigs) {
			this.createLeftRoomDoor(config.room, config.label, config.centerZ, config.color);
		}
	}
	private createUpstairs() {
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
		this.toiletHole = new THREE.Group();
		this.toiletHole.position.set(TOILET_X, 0, TOILET_Z);
		const toiletEdge = getToiletHoleEdgePoints();
		this.toiletFloorPlug = new THREE.Group();
		this.toiletFloorPlug.position.set(TOILET_X, -0.001, TOILET_Z);
		const floorPlug = shadowMesh(makeIrregularDiscGeometry(toiletEdge), material(0xb9d1cf, 0.94));
		floorPlug.receiveShadow = true;
		this.toiletFloorPlug.add(floorPlug);
		const toiletDarkness = new THREE.Mesh(
			makeIrregularDiscGeometry(toiletEdge),
			new THREE.MeshBasicMaterial({
				color: 0x152019,
				side: THREE.DoubleSide,
				transparent: true,
				opacity: 0.2,
				depthWrite: false
			})
		);
		toiletDarkness.position.y = -0.12;
		toiletDarkness.renderOrder = 3;
		const toiletRim = shadowMesh(
			makeIrregularRingGeometry(toiletEdge, 0.13),
			material(0x47443d, 0.98)
		);
		toiletRim.position.y = 0.038;

		const cracks = makeToiletFloorCracks(toiletEdge);
		cracks.position.y = 0.052;

		const shaftWall = new THREE.Mesh(
			new THREE.CylinderGeometry(1.12, 0.92, 7.7, 16, 1, true),
			new THREE.MeshStandardMaterial({
				color: 0x4a5142,
				roughness: 1,
				side: THREE.BackSide
			})
		);
		shaftWall.position.y = -3.95;
		shaftWall.receiveShadow = true;

		const shaftBottom = new THREE.Mesh(
			new THREE.CircleGeometry(1.12, 20),
			new THREE.MeshBasicMaterial({ color: 0x29382e, side: THREE.DoubleSide })
		);
		shaftBottom.rotation.x = -Math.PI / 2;
		shaftBottom.position.y = -7.78;

		const shaftRings = [-0.78, -2.05, -3.35].map((height, index) => {
			const ring = new THREE.Mesh(
				new THREE.TorusGeometry(0.94 + index * 0.035, 0.045, 7, 20),
				material(0x62594a, 0.96, 0.08)
			);
			ring.rotation.x = Math.PI / 2;
			ring.position.y = height;
			return ring;
		});
		const shaftLight = new THREE.PointLight(0x9fbd8b, 2.6, 8, 2);
		shaftLight.position.set(0.08, -2.2, 0.12);

		this.toiletHole.add(
			shaftWall,
			shaftBottom,
			...shaftRings,
			shaftLight,
			toiletDarkness,
			toiletRim,
			cracks
		);
		this.toiletHole.visible = false;
		const bathroomRoot = this.leftRoomInteriorRoots.get('bathroom') ?? this.scene;
		bathroomRoot.add(this.toiletFloorPlug, this.toiletHole);

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
	private createSewer() {
		const shaftGlow = new THREE.PointLight(0xb9d19b, 5.5, 8, 2);
		shaftGlow.position.set(TOILET_X, -1.3, SEWER_CENTER_Z + 0.2);
		this.sewerRoot.add(shaftGlow);
		const rayTopY = -0.32;
		const rayBottomY = SEWER_FLOOR_Y + 0.18;
		const rayHeight = rayTopY - rayBottomY;
		for (const [index, offset] of [-0.2, 0.04, 0.24].entries()) {
			const ray = new THREE.Mesh(
				new THREE.CylinderGeometry(0.07, 0.72 - index * 0.12, rayHeight, 18, 1, true),
				new THREE.MeshBasicMaterial({
					color: index === 1 ? 0xd8e8bb : 0xb9d19b,
					transparent: true,
					opacity: index === 1 ? 0.095 : 0.052,
					depthWrite: false,
					blending: THREE.AdditiveBlending,
					side: THREE.DoubleSide,
					toneMapped: false
				})
			);
			ray.position.set(
				TOILET_X + offset,
				(rayTopY + rayBottomY) / 2,
				SEWER_CENTER_Z + (index - 1) * 0.18
			);
			ray.rotation.z = (index - 1) * 0.025;
			ray.renderOrder = 1;
			this.sewerRoot.add(ray);
		}
		this.createPoopieMonster();

		const distantGlow = new THREE.PointLight(0xffb260, 8, 11, 2);
		distantGlow.position.set(SEWER_MAX_X - 2.2, SEWER_FLOOR_Y + 2.3, SEWER_CENTER_Z + 0.2);
		this.sewerRoot.add(distantGlow);
		for (let x = TOILET_X + 4; x < SEWER_MAX_X - 5; x += 14) {
			const tunnelLight = new THREE.PointLight(0x799066, 3.4, 12, 2);
			tunnelLight.position.set(x, SEWER_FLOOR_Y + 2.9, SEWER_CENTER_Z + 0.25);
			this.sewerRoot.add(tunnelLight);
		}
		this.sewerLight.position.set(TOILET_X + 1.5, SEWER_FLOOR_Y + 2.6, SEWER_CENTER_Z + 0.4);
		this.sewerRoot.add(this.sewerLight);
	}
	private createPoopieMonster() {
		this.poopieMonsterRoot = new THREE.Group();
		this.poopieMonsterRoot.position.set(POOPIE_MONSTER_X, SEWER_FLOOR_Y, SEWER_CENTER_Z);
		this.poopieMonsterPose = new THREE.Group();
		this.poopieMonsterRoot.add(this.poopieMonsterPose);
		this.poopieMonsterFacing = new THREE.Group();
		this.poopieMonsterFacing.rotation.y = -Math.PI / 2;
		this.poopieMonsterPose.add(this.poopieMonsterFacing);
		this.poopieMonsterMaterials = [];
		this.poopieMonsterArms = [];
		this.poopieMonsterIntroLines = this.makePoopieMonsterIntroLines();
		this.poopieMonsterIntroLines.position.set(0.78, POOPIE_MONSTER_HEIGHT * 0.58, 0);
		this.poopieMonsterIntroLines.visible = false;
		this.poopieMonsterRoot.add(this.poopieMonsterIntroLines);

		this.poopieMonsterWarning = this.makePoopieMonsterWarning();
		this.poopieMonsterWarning.position.set(0, POOPIE_MONSTER_HEIGHT + 0.98, 0.72);
		this.poopieMonsterRoot.add(this.poopieMonsterWarning);
		this.poopieMonsterStatus = this.makePoopieMonsterStatus();
		this.poopieMonsterStatus.position.set(0, POOPIE_MONSTER_HEIGHT + 0.68, -0.58);
		this.poopieMonsterRoot.add(this.poopieMonsterStatus);

		const heartShape = new THREE.Shape();
		heartShape.moveTo(0, -0.26);
		heartShape.bezierCurveTo(-0.52, -0.02, -0.58, 0.43, -0.25, 0.52);
		heartShape.bezierCurveTo(-0.08, 0.57, 0, 0.43, 0, 0.33);
		heartShape.bezierCurveTo(0, 0.43, 0.08, 0.57, 0.25, 0.52);
		heartShape.bezierCurveTo(0.58, 0.43, 0.52, -0.02, 0, -0.26);
		this.poopieMonsterHeart = new THREE.Mesh(
			new THREE.ShapeGeometry(heartShape, 10),
			new THREE.MeshStandardMaterial({
				color: 0xe95764,
				roughness: 0.42,
				emissive: 0x6d101b,
				emissiveIntensity: 0.8,
				side: THREE.DoubleSide
			})
		);
		this.poopieMonsterHeart.position.set(0, POOPIE_MONSTER_HEIGHT + 0.38, 0.58);
		this.poopieMonsterHeart.scale.setScalar(0.32);
		this.poopieMonsterHeart.visible = false;
		this.poopieMonsterRoot.add(this.poopieMonsterHeart);
		this.sewerRoot.add(this.poopieMonsterRoot);
		this.resetPoopieMonster();
	}

	private makePoopieMonsterWarning() {
		const canvas = document.createElement('canvas');
		canvas.width = 1024;
		canvas.height = 256;
		const context = canvas.getContext('2d');
		if (!context) return new THREE.Sprite();

		context.fillStyle = 'rgba(30, 20, 14, 0.92)';
		context.beginPath();
		context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 36);
		context.fill();
		context.strokeStyle = '#c88747';
		context.lineWidth = 10;
		context.stroke();
		context.fillStyle = '#f3e5c8';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.font = '900 66px Arial Black, Arial, sans-serif';
		context.fillText('You shall not pass', canvas.width / 2, 92);
		context.font = '900 58px Arial Black, Arial, sans-serif';
		context.fillText('the poopiemonster!', canvas.width / 2, 172);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const warning = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: texture,
				transparent: true,
				depthTest: false,
				depthWrite: false,
				toneMapped: false
			})
		);
		warning.name = 'poopiemonster-warning';
		warning.scale.set(4.2, 1.05, 1);
		warning.renderOrder = 8;
		return warning;
	}

	private makePoopieMonsterIntroLines() {
		const canvas = document.createElement('canvas');
		canvas.width = 1024;
		canvas.height = 1024;
		const context = canvas.getContext('2d');
		if (context) {
			context.translate(canvas.width / 2, canvas.height / 2);
			for (let index = 0; index < 86; index += 1) {
				const noise = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
				const angle = (index / 86) * Math.PI * 2 + (noise - 0.5) * 0.035;
				const innerRadius = 84 + noise * 92;
				const outerRadius = 650;
				const halfWidth = 0.006 + noise * 0.012;
				context.fillStyle = `rgba(246, 220, 164, ${0.15 + noise * 0.34})`;
				context.beginPath();
				context.moveTo(
					Math.cos(angle - halfWidth) * innerRadius,
					Math.sin(angle - halfWidth) * innerRadius
				);
				context.lineTo(
					Math.cos(angle + halfWidth) * innerRadius,
					Math.sin(angle + halfWidth) * innerRadius
				);
				context.lineTo(
					Math.cos(angle + halfWidth * 0.18) * outerRadius,
					Math.sin(angle + halfWidth * 0.18) * outerRadius
				);
				context.lineTo(
					Math.cos(angle - halfWidth * 0.18) * outerRadius,
					Math.sin(angle - halfWidth * 0.18) * outerRadius
				);
				context.closePath();
				context.fill();
			}
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: texture,
				transparent: true,
				depthTest: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				toneMapped: false
			})
		);
		sprite.name = 'poopiemonster-intro-speedlines';
		sprite.scale.set(6.2, 6.2, 1);
		return sprite;
	}

	private makePoopieMonsterStatus() {
		const canvas = document.createElement('canvas');
		canvas.width = 768;
		canvas.height = 224;
		this.poopieMonsterStatusTexture = new THREE.CanvasTexture(canvas);
		this.poopieMonsterStatusTexture.colorSpace = THREE.SRGBColorSpace;
		const status = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: this.poopieMonsterStatusTexture,
				transparent: true,
				depthTest: true,
				depthWrite: false,
				toneMapped: false
			})
		);
		status.name = 'poopiemonster-status';
		status.scale.set(3.35, 0.98, 1);
		status.renderOrder = 4;
		this.updatePoopieMonsterStatus();
		return status;
	}

	private updatePoopieMonsterStatus() {
		const texture = this.poopieMonsterStatusTexture;
		const canvas = texture?.image as HTMLCanvasElement | undefined;
		const context = canvas?.getContext('2d');
		if (!texture || !canvas || !context) return;

		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = 'rgba(28, 20, 16, 0.9)';
		context.beginPath();
		context.roundRect(12, 12, canvas.width - 24, canvas.height - 24, 34);
		context.fill();
		context.strokeStyle = '#d29a58';
		context.lineWidth = 8;
		context.stroke();

		const drawBar = (label: string, progress: number, y: number, color: string) => {
			context.fillStyle = '#f4e5c7';
			context.font = '900 42px Arial Black, Arial, sans-serif';
			context.textAlign = 'right';
			context.textBaseline = 'middle';
			context.fillText(label, 174, y + 24);
			context.fillStyle = '#40342c';
			context.beginPath();
			context.roundRect(198, y, 520, 48, 18);
			context.fill();
			const width = 520 * THREE.MathUtils.clamp(progress, 0, 1);
			if (width > 0) {
				context.fillStyle = color;
				context.beginPath();
				context.roundRect(198, y, width, 48, Math.min(18, width / 2));
				context.fill();
			}
		};

		drawBar('HP', this.poopieMonsterHealth / POOPIE_MONSTER_BULLET_HITS, 48, '#db4d42');
		drawBar('LOVE', this.poopieMonsterPoopHits / POOPIE_MONSTER_POOP_HITS, 128, '#ec7895');
		texture.needsUpdate = true;
	}

	private attachPoopieMonster(source: THREE.Group) {
		this.poopieMonsterFacing.clear();
		this.poopieMonsterMaterials = [];
		const brownPalette = [0x8d5c3b, 0x75462d, 0x9a6843, 0x5f3826];
		const brownMaterials = new Map<THREE.Material, THREE.MeshStandardMaterial>();

		// The Sketchfab root already converts the original Z-up mesh to glTF's Y-up space.
		source.rotation.set(0, 0, 0);
		source.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			child.castShadow = true;
			child.receiveShadow = true;
			const originalMaterials = Array.isArray(child.material) ? child.material : [child.material];
			const recolored = originalMaterials.map((original) => {
				const materialNumber = Number.parseInt(original.name.replace('material_', ''), 10);
				if (!Number.isFinite(materialNumber) || materialNumber < 75) return original;
				const existing = brownMaterials.get(original);
				if (existing) return existing;
				const brown = new THREE.MeshStandardMaterial({
					name: `${original.name}_poopie_brown`,
					color: brownPalette[(materialNumber - 75) % brownPalette.length],
					roughness: 0.96,
					metalness: 0,
					emissive: 0x140906,
					emissiveIntensity: 0.08,
					side: THREE.DoubleSide
				});
				brownMaterials.set(original, brown);
				this.poopieMonsterMaterials.push(brown);
				return brown;
			});
			child.material = Array.isArray(child.material) ? recolored : recolored[0];
		});

		source.updateMatrixWorld(true);
		const initialBounds = new THREE.Box3().setFromObject(source);
		const size = initialBounds.getSize(new THREE.Vector3());
		source.scale.setScalar(POOPIE_MONSTER_HEIGHT / Math.max(size.y, 0.001));
		source.updateMatrixWorld(true);
		const bounds = new THREE.Box3().setFromObject(source);
		const center = bounds.getCenter(new THREE.Vector3());
		source.position.set(-center.x, -bounds.min.y, -center.z);
		this.poopieMonsterFacing.add(source);
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
		this.createLockedKitchenBackDoor();
		const doorMinZ = DOOR_CENTER_Z - DOOR_WIDTH / 2;
		const doorMaxZ = DOOR_CENTER_Z + DOOR_WIDTH / 2;
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
		this.bulletImpactSurfaceMaterials.set(leaf, 'wood');
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

	private async loadModels() {
		const [rabbitGltf, pistolGltf, g36Gltf, poopieMonsterGltf] = await Promise.all([
			this.loader.loadAsync('/models/konijn-v18.glb'),
			this.loader.loadAsync('/models/low-poly-g17.glb'),
			this.loader.loadAsync('/models/g36.glb'),
			this.loader.loadAsync('/models/poopiemonster.glb')
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
		this.attachG36(model, g36Gltf.scene);
		this.populateGunRack(g36Gltf.scene);
		this.createG36Pickup(g36Gltf.scene);
		this.setupArmRagdolls(model);
		this.attachPoopieMonster(poopieMonsterGltf.scene);

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

	private makeG36Clone(source: THREE.Group) {
		const root = new THREE.Group();
		const model = source.clone(true);
		model.updateMatrixWorld(true);
		const modelBounds = new THREE.Box3().setFromObject(model);
		const center = modelBounds.getCenter(new THREE.Vector3());
		model.position.sub(center);
		model.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			child.castShadow = true;
			child.receiveShadow = true;
		});
		root.add(model);
		return root;
	}

	private attachG36(model: THREE.Group, g36Model: THREE.Group) {
		const rightArm = model.getObjectByName('right_arm');
		if (!rightArm) return;

		const pivot = new THREE.Group();
		pivot.name = 'held_g36_grip';
		pivot.position.set(-0.02, -0.1, 0.075);
		pivot.rotation.set(0.12, -0.14, 0.12);

		const gun = this.makeG36Clone(g36Model);
		gun.name = 'g36';
		gun.rotation.y = -Math.PI / 2;
		gun.scale.setScalar(1.02);
		pivot.add(gun);

		const muzzle = new THREE.Object3D();
		muzzle.name = 'held_g36_muzzle';
		muzzle.position.set(0, 0.035, 0.535);
		pivot.add(muzzle);
		rightArm.add(pivot);

		this.g36Pivot = pivot;
		this.g36Muzzle = muzzle;
		this.syncWeaponModel();
	}

	private populateGunRack(g36Model: THREE.Group) {
		this.gunRackDisplayRoot.clear();
		for (let index = 0; index < 2; index += 1) {
			const rifle = this.makeG36Clone(g36Model);
			rifle.scale.setScalar(2.32);
			rifle.position.set(0, 1.6 - index * 0.9, 0.28);
			rifle.rotation.z = index === 0 ? -0.035 : 0.045;
			this.gunRackDisplayRoot.add(rifle);
		}
	}

	private createG36Pickup(g36Model: THREE.Group) {
		this.g36Pickup.clear();
		const rifle = this.makeG36Clone(g36Model);
		rifle.scale.setScalar(1.18);
		rifle.rotation.set(0, 0.16, -0.08);
		this.g36Pickup.add(rifle);

		const ringMaterial = new THREE.MeshStandardMaterial({
			color: COLORS.orange,
			roughness: 0.38,
			emissive: 0x8e2b0c,
			emissiveIntensity: 1.4
		});
		this.g36PickupRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 8, 40), ringMaterial);
		this.g36PickupRing.rotation.x = Math.PI / 2;
		this.g36PickupRing.position.y = -0.12;
		this.g36Pickup.add(this.g36PickupRing);
		this.g36Pickup.position.set(7.65, UPSTAIRS_FLOOR_Y + 0.23, -3.55);
		this.g36Pickup.visible = false;
		this.upstairsRoot.add(this.g36Pickup);
	}

	private syncWeaponModel() {
		if (this.pistolPivot) this.pistolPivot.visible = this.weapon === 'pistol';
		if (this.g36Pivot) this.g36Pivot.visible = this.weapon === 'g36' && this.g36Unlocked;
	}

	private dropG36Pickup() {
		if (this.g36Unlocked || !this.g36Pickup.children.length) return;
		this.g36PickupAvailable = true;
		this.g36PickupTime = 0;
		this.g36Pickup.position.set(7.65, UPSTAIRS_FLOOR_Y + 0.23, -3.55);
		this.g36Pickup.visible = true;
		this.emitFeedback('G36 UIT HET REK! RAAK HEM AAN!');
	}

	private updateG36Pickup(delta: number) {
		if (!this.g36PickupAvailable || this.g36Unlocked) return;
		this.g36PickupTime += delta;
		if (this.g36PickupRing) {
			this.g36PickupRing.rotation.z += delta * 1.8;
			this.g36PickupRing.material.emissiveIntensity =
				1.25 + Math.sin(this.g36PickupTime * 4.2) * 0.3;
		}
		if (!this.playerUpstairs) return;
		const dx = this.player.position.x - this.g36Pickup.position.x;
		const dz = this.player.position.z - this.g36Pickup.position.z;
		const closeEnough = Math.hypot(dx, dz) <= PLAYER_RADIUS + 0.82;
		const verticallyClose =
			this.player.position.y <= this.g36Pickup.position.y + 1.1 &&
			this.player.position.y + PLAYER_HEIGHT >= this.g36Pickup.position.y - 0.2;
		if (!closeEnough || !verticallyClose) return;

		this.g36Unlocked = true;
		this.g36PickupAvailable = false;
		this.g36Pickup.visible = false;
		this.weaponHeld = false;
		this.weaponCooldown = 0;
		this.weapon = 'g36';
		this.syncWeaponModel();
		this.audio.playWeaponChange();
		this.emitFeedback('G36 GEVONDEN! HOUD RMB VOOR RATATAT!');
		this.emitHud(true);
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
		this.upstairsBreakables.push(
			this.addBreakable(
				'KO-9 COMMAND DESK',
				780,
				this.makeKo9HackerDesk(),
				[0.25, UPSTAIRS_FLOOR_Y, -1.45],
				2.55,
				2.45,
				'electronics',
				2
			)
		);
		this.upstairsBreakables.push(
			this.addBreakable(
				'GEHEIM ARCHIEF',
				360,
				this.makeKo9Archive(),
				[-10.05, UPSTAIRS_FLOOR_Y, -4.18],
				1.5,
				2.52,
				'metal',
				2
			)
		);
		this.gunRackBreakable = this.addBreakable(
			'WAPENREK',
			620,
			this.makeKo9GunRack(),
			[7.65, UPSTAIRS_FLOOR_Y, -4.72],
			1.82,
			2.35,
			'metal',
			2
		);
		this.upstairsBreakables.push(this.gunRackBreakable);
		this.upstairsBreakables.push(
			this.addBreakable(
				'KO-9 KLUIS',
				1200,
				this.makeKo9Safe(),
				[12.15, UPSTAIRS_FLOOR_Y, -4.08],
				1.05,
				2.02,
				'metal',
				3
			)
		);
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
		this.addBreakable(
			'HONDENHOK',
			140,
			this.makeDoghouse(),
			[DOGHOUSE_X, 0, DOGHOUSE_Z],
			1.12,
			1.72,
			'wood'
		);
		this.addBreakable(
			'PICKNICKTAFEL',
			260,
			this.makePicnicTable(),
			[8.75, 0, -10.15],
			2.25,
			1.72,
			'wood',
			2
		);
		const leftGardenChair = this.makeGardenChair(COLORS.orange);
		leftGardenChair.rotation.y = 0.42;
		this.addBreakable('TUINSTOEL', 45, leftGardenChair, [-4.2, 0, -9.4], 0.82, 1.15, 'wood');
		const rightGardenChair = this.makeGardenChair(COLORS.blue);
		rightGardenChair.rotation.y = -0.55;
		this.addBreakable('TUINSTOEL', 45, rightGardenChair, [0.8, 0, -11.2], 0.82, 1.15, 'wood');
		this.poolBreakable = this.addBreakable(
			'ZWEMBAD',
			320,
			this.makePool(),
			[POOL_X, 0, POOL_Z],
			2.2,
			0.82,
			'canvas'
		);
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
		this.gunRackDisplayRoot = new THREE.Group();
		group.add(this.gunRackDisplayRoot);
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

	private createToiletRoomDecor(parent: THREE.Object3D) {
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
			parent.add(frame);
		}

		const sideArt = this.makeArtwork('/images/artwork/29.webp');
		sideArt.position.set(LEFT_ROOMS_MIN_X + 0.18, 1.34, -3.18);
		sideArt.scale.setScalar(0.3);
		sideArt.rotation.set(0, Math.PI / 2, -0.05);
		parent.add(sideArt);

		const calendar = this.makeToiletCalendar();
		calendar.position.set(-10.62, 1.3, BACK_WALL_Z + 0.18);
		parent.add(calendar);

		const plunger = new THREE.Group();
		plunger.add(cylinder(0.085, 0.21, 0.2, [0, 0.1, 0], 0xb84c3e, 18));
		plunger.add(cylinder(0.03, 0.034, 0.88, [0, 0.62, 0], 0x876044, 10));
		plunger.position.set(-13.16, 0, -2.82);
		plunger.rotation.z = -0.12;
		parent.add(plunger);

		const toiletBrush = new THREE.Group();
		toiletBrush.add(cylinder(0.14, 0.12, 0.34, [0, 0.17, 0], 0xe8e1d5, 16));
		toiletBrush.add(cylinder(0.026, 0.026, 0.72, [0, 0.67, 0], 0x3e4744, 10));
		const brushGrip = shadowMesh(new THREE.SphereGeometry(0.055, 10, 8), material(0x3e4744));
		brushGrip.position.y = 1.04;
		toiletBrush.add(brushGrip);
		toiletBrush.position.set(-13.2, 0, -3.58);
		parent.add(toiletBrush);

		const toiletCleaner = this.makeToiletCleaner();
		toiletCleaner.position.set(-9.62, 0, -4.22);
		toiletCleaner.rotation.y = -0.08;
		parent.add(toiletCleaner);
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
		leftRoof.rotation.z = 0.58;
		const rightRoof = box([1.08, 0.14, 1.92], [0.42, 1.38, 0], 0x5e4438);
		rightRoof.rotation.z = -0.58;
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

	private makeDogBone() {
		const group = new THREE.Group();
		group.add(box([0.62, 0.12, 0.15], [0, 0.1, 0], 0xe7dfcd));
		for (const x of [-0.36, 0.36]) {
			for (const z of [-0.08, 0.08]) {
				const end = shadowMesh(new THREE.SphereGeometry(0.13, 10, 8), material(0xe7dfcd));
				end.position.set(x, 0.1, z);
				group.add(end);
			}
		}
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

	private makePicnicTable() {
		const group = new THREE.Group();
		const timber = 0x8a5a36;
		const timberDark = 0x654027;
		for (let plank = 0; plank < 4; plank += 1) {
			group.add(
				box(
					[3.72, 0.16, 0.32],
					[0, 1.04, -0.51 + plank * 0.34],
					plank % 2 === 0 ? timber : 0x98643b
				)
			);
		}
		for (const z of [-1.04, 1.04]) {
			group.add(box([3.55, 0.16, 0.42], [0, 0.58, z], timber));
		}
		for (const x of [-1.28, 1.28]) {
			for (const side of [-1, 1]) {
				const leg = box([0.18, 1.05, 0.2], [x, 0.5, side * 0.48], timberDark);
				leg.rotation.x = side * 0.34;
				group.add(leg);
			}
			group.add(box([0.18, 0.18, 2.22], [x, 0.45, 0], timberDark));
		}
		group.add(box([3.05, 0.15, 0.18], [0, 0.32, 0], timberDark));

		for (let row = 0; row < 4; row += 1) {
			for (let column = 0; column < 5; column += 1) {
				group.add(
					box(
						[0.25, 0.018, 0.25],
						[-0.5 + column * 0.25, 1.138, -0.375 + row * 0.25],
						(row + column) % 2 === 0 ? 0xeadbc1 : 0xc95646
					)
				);
			}
		}

		const placeSettingPositions: Array<[number, number]> = [
			[-1.35, -0.32],
			[-0.82, 0.35],
			[0.78, -0.34],
			[1.38, 0.34]
		];
		for (let index = 0; index < placeSettingPositions.length; index += 1) {
			const [x, z] = placeSettingPositions[index];
			const plate = cylinder(
				0.26,
				0.28,
				0.04,
				[x, 1.17, z],
				index % 2 === 0 ? 0xe8e2d4 : 0x83b7c7,
				24
			);
			group.add(plate);
			const glass = shadowMesh(
				new THREE.CylinderGeometry(0.065, 0.08, 0.24, 12),
				material(0xabcfd0, 0.18, 0.15)
			);
			glass.position.set(x + 0.28, 1.29, z - 0.02);
			group.add(glass);
			group.add(
				box(
					[0.22, 0.025, 0.22],
					[x - 0.26, 1.17, z + 0.08],
					index % 2 === 0 ? 0xe87832 : 0xf2d16f,
					0.12 * (index - 1.5)
				)
			);
		}

		const saladBowl = cylinder(0.3, 0.23, 0.15, [-0.12, 1.21, 0], 0x4e8f78, 20);
		group.add(saladBowl);
		for (let leaf = 0; leaf < 6; leaf += 1) {
			const lettuce = shadowMesh(
				new THREE.SphereGeometry(0.105, 9, 7),
				material(leaf % 2 === 0 ? 0x77a94e : 0xa2bd61)
			);
			lettuce.scale.y = 0.55;
			lettuce.position.set(-0.28 + (leaf % 3) * 0.15, 1.34, -0.08 + Math.floor(leaf / 3) * 0.16);
			group.add(lettuce);
		}

		const baguette = shadowMesh(new THREE.CapsuleGeometry(0.105, 0.72, 5, 12), material(0xd79b55));
		baguette.rotation.z = Math.PI / 2;
		baguette.position.set(0.08, 1.27, 0.43);
		group.add(baguette);
		for (const x of [-0.22, 0, 0.22]) {
			const score = box([0.035, 0.015, 0.16], [x, 1.38, 0.43], 0xf1c67d);
			score.rotation.z = 0.25;
			group.add(score);
		}

		for (const [radius, height, y, color] of [
			[0.2, 0.08, 1.2, 0xd4934b],
			[0.18, 0.05, 1.265, 0x6e9a47],
			[0.2, 0.08, 1.33, 0xd4934b]
		] as Array<[number, number, number, number]>) {
			group.add(cylinder(radius, radius, height, [0.8, y, 0.08], color, 18));
		}

		for (const [x, color] of [
			[1.05, 0xc84f3f],
			[1.28, 0xe1b63f]
		] as Array<[number, number]>) {
			group.add(cylinder(0.07, 0.09, 0.3, [x, 1.3, -0.18], color, 12));
			group.add(cylinder(0.035, 0.045, 0.08, [x, 1.49, -0.18], 0xf0e3c9, 10));
		}

		for (let fruit = 0; fruit < 5; fruit += 1) {
			const piece = shadowMesh(
				new THREE.SphereGeometry(0.1, 10, 8),
				material([0xd4523d, 0xe6ad3e, 0x76a14d][fruit % 3])
			);
			piece.position.set(-0.48 + fruit * 0.16, 1.28 + (fruit % 2) * 0.08, -0.42);
			group.add(piece);
		}
		return group;
	}

	private makePool() {
		const group = new THREE.Group();
		const wall = shadowMesh(
			new THREE.CylinderGeometry(2.06, 2.12, 0.68, 40, 1, true),
			new THREE.MeshStandardMaterial({
				color: 0x4fa7c7,
				roughness: 0.72,
				side: THREE.DoubleSide
			})
		);
		wall.position.y = 0.34;
		group.add(wall);
		group.add(cylinder(2.08, 2.08, 0.1, [0, 0.05, 0], 0x378eae, 40));
		group.add(cylinder(1.88, 1.88, 0.025, [0, 0.115, 0], 0x277f9e, 40));

		const waterGeometry = new THREE.CircleGeometry(POOL_WATER_RADIUS, 48);
		const waterPositions = waterGeometry.getAttribute('position') as THREE.BufferAttribute;
		waterPositions.setUsage(THREE.DynamicDrawUsage);
		this.poolWaterBasePositions = Float32Array.from(waterPositions.array as ArrayLike<number>);
		this.poolWater = new THREE.Mesh(
			waterGeometry,
			new THREE.MeshPhysicalMaterial({
				color: 0x57cbe2,
				roughness: 0.12,
				metalness: 0,
				clearcoat: 0.72,
				clearcoatRoughness: 0.2,
				transparent: true,
				opacity: 0.72,
				depthWrite: false,
				side: THREE.DoubleSide
			})
		);
		this.poolWater.rotation.x = -Math.PI / 2;
		this.poolWater.position.y = POOL_WATER_Y;
		this.poolWater.renderOrder = 1;
		group.add(this.poolWater);
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
		const realDelta = Math.min(this.timer.getDelta(), 0.034);
		const delta =
			realDelta * (this.poopieMonsterDeathInProgress ? POOPIE_MONSTER_DEATH_TIME_SCALE : 1);
		if (!this.paused) {
			if (this.phase === 'playing') this.updateGame(delta);
			this.updateDebris(delta);
			this.updateImpactRings(delta);
			this.updatePoolWater(delta);
			this.updateWeaponProjectiles(delta);
			this.updateMuzzleEffects(delta);
			this.updateToilet(delta);
			this.updatePoopieMonster(delta);
		}
		this.updateCamera(delta);
		this.renderer.render(this.scene, this.camera);
	};

	private updateGame(delta: number) {
		this.syncUpstairsVisibility();
		this.weaponCooldown = Math.max(0, this.weaponCooldown - delta);
		this.basementEntryCooldown = Math.max(0, this.basementEntryCooldown - delta);
		this.poolSplashCooldown = Math.max(0, this.poolSplashCooldown - delta);
		this.audio.update(delta);
		if (this.sewerIntroActive) {
			this.updateSewerIntro(delta);
			return;
		}
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
		this.updateG36Pickup(delta);
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

	private syncGroundRoomVisibility() {
		this.kitchenInteriorRoot.visible = this.doorOpen;
		for (const door of this.leftRoomDoors) {
			const interiorRoot = this.leftRoomInteriorRoots.get(door.room);
			if (interiorRoot) interiorRoot.visible = door.open;
		}

		const groundBiomeActive = this.getActiveBiome() === 'ground';
		for (const breakable of this.breakables) {
			if (breakable.biome !== 'ground' || this.upstairsBreakables.includes(breakable)) continue;
			const position = breakable.group.position;
			let roomUnlocked = true;
			if (
				position.x >= KITCHEN_MIN_X &&
				position.x <= KITCHEN_MAX_X &&
				position.z >= BACK_WALL_Z &&
				position.z <= ROOM_DEPTH / 2
			) {
				roomUnlocked = this.doorOpen;
			} else if (
				position.x >= LEFT_ROOMS_MIN_X &&
				position.x <= LEFT_ROOMS_MAX_X &&
				position.z >= BACK_WALL_Z &&
				position.z <= ROOM_DEPTH / 2
			) {
				const room: LeftRoomName =
					position.z < BATHROOM_MAX_Z
						? 'bathroom'
						: position.z < BEDROOM_MIN_Z
							? 'stairs'
							: 'bedroom';
				roomUnlocked = this.leftRoomDoors.some((door) => door.room === room && door.open);
			}

			const sinkingToilet = breakable === this.toiletBreakable && this.toiletSinking;
			breakable.group.visible =
				groundBiomeActive && roomUnlocked && (!breakable.broken || sinkingToilet);
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
			if (this.isAtUpstairsStairOpening()) {
				this.playerUpstairs = false;
				this.playerLeftRoom = 'stairs';
				this.player.position.set(STAIR_DESCENT_SPAWN_X, STAIR_DESCENT_SPAWN_Y + 0.06, STAIR_TOP_Z);
				this.velocity.set(
					Math.max(2.6, Math.abs(this.velocity.x) * 0.72),
					-1.6,
					this.velocity.z * 0.24
				);
				this.syncUpstairsVisibility();
				this.emitFeedback('TERUG DE TRAP AF!');
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
			if (this.shouldEnterUpstairsFromStairs()) {
				const carriedHeight = Math.max(0, this.player.position.y - (UPSTAIRS_FLOOR_Y - 0.08));
				this.playerLeftRoom = null;
				this.playerUpstairs = true;
				this.player.position.set(
					UPSTAIRS_STAIRWELL_MAX_X + PLAYER_RADIUS + 0.16,
					UPSTAIRS_FLOOR_Y + Math.min(1.55, carriedHeight),
					STAIR_TOP_Z
				);
				this.velocity.set(
					Math.max(1.45, Math.abs(this.velocity.x) * 0.34),
					Math.max(1.1, this.velocity.y * 0.82),
					this.velocity.z * 0.55
				);
				this.syncUpstairsVisibility();
				this.emitFeedback('BOVENVERDIEPING!');
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
				this.emitFeedback('RAAM BARST! NOG 1 GOEDE STAMP!');
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
			this.velocity.set(0, 0, 0);
			this.syncBiomeState();
			this.startSewerIntro();
			return;
		} else if (topHatchOpening && this.player.position.y < -0.65) {
			this.playerInBasement = true;
			this.playerOutside = false;
			this.playerInKitchen = false;
			this.playerLeftRoom = null;
			this.basementEntryCooldown = 0.85;
			this.velocity.x = Math.min(this.velocity.x, -2.4);
			this.syncBiomeState();
			this.emitFeedback('DE KELDER IN!');
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
					this.emitFeedback('TERUG NAAR BOVEN!');
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
				this.emitFeedback('DOOR DE WC WEER OMHOOG!');
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
			this.audio.playCue('wall');
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
		const overPoolWater = this.isPlayerOverPoolInterior();
		const floorHeight = overPoolWater
			? (this.poolBreakable?.group.position.y ?? 0) + POOL_BOTTOM_Y
			: this.getActiveFloorHeight();
		const canFallThroughLevel = topToiletOpening || topHatchOpening;
		if (!canFallThroughLevel && this.player.position.y <= floorHeight) {
			const impactSpeed = Math.abs(this.velocity.y);
			const stampImpactSpeed = this.velocity.length();
			const floorNormal = new THREE.Vector3(0, 1, 0);
			this.player.position.y = floorHeight;
			this.standRabbitUpright();
			if (overPoolWater && this.isTargetStampSurface(floorNormal) && stampImpactSpeed > 2.8) {
				this.performPoolStamp(stampImpactSpeed);
				this.finishStampRebound(floorNormal, 0.62, stampImpactSpeed);
			} else if (overPoolWater) {
				this.velocity.y = Math.max(6.1, impactSpeed * 0.34);
				this.squash = Math.min(0.72, impactSpeed / 18);
				this.joltArms(1.15 + Math.min(impactSpeed, 12) * 0.08);
				this.spawnPoolSplash(Math.max(4, impactSpeed * 0.7), 0.72);
			} else if (this.isTargetStampSurface(floorNormal) && stampImpactSpeed > 2.8) {
				this.performGroundStamp(stampImpactSpeed);
				this.finishStampRebound(floorNormal, 0.7, stampImpactSpeed);
			} else {
				this.velocity.y = Math.max(5.2, impactSpeed * 0.38);
				this.squash = Math.min(0.82, impactSpeed / 17);
				this.joltArms(1.05 + Math.min(impactSpeed, 12) * 0.08);
				this.audio.playCue('bounce');
			}
		}
	}

	private resolveSewerObstacleCollisions() {
		if (this.resolvePoopieMonsterCollision()) return;
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

	private resolvePoopieMonsterCollision() {
		if (!this.playerInSewer || this.poopieMonsterState !== 'neutral') return false;
		const minX = POOPIE_MONSTER_X - POOPIE_MONSTER_RADIUS;
		const maxX = POOPIE_MONSTER_X + POOPIE_MONSTER_RADIUS;
		const minY = SEWER_FLOOR_Y;
		// A neutral Poopiemonster owns the full tunnel cross-section. The visual body may
		// jump, but the player cannot squeeze over or under him until the encounter resolves.
		const maxY = SEWER_CEILING_Y;
		const playerLeft = this.player.position.x - PLAYER_RADIUS;
		const playerRight = this.player.position.x + PLAYER_RADIUS;
		const playerBottom = this.player.position.y;
		const playerTop = playerBottom + PLAYER_HEIGHT;
		if (playerRight <= minX || playerLeft >= maxX || playerTop <= minY || playerBottom >= maxY) {
			return false;
		}

		const candidates = [
			{ depth: playerRight - minX, normal: new THREE.Vector3(-1, 0, 0) },
			{ depth: maxX - playerLeft, normal: new THREE.Vector3(1, 0, 0) },
			{ depth: playerTop - minY, normal: new THREE.Vector3(0, -1, 0) },
			{ depth: maxY - playerBottom, normal: new THREE.Vector3(0, 1, 0) }
		];
		candidates.sort((a, b) => a.depth - b.depth);
		const collision = candidates[0];
		const normal = collision.normal;
		if (normal.x < 0) this.player.position.x = minX - PLAYER_RADIUS;
		else if (normal.x > 0) this.player.position.x = maxX + PLAYER_RADIUS;
		else if (normal.y < 0) this.player.position.y = minY - PLAYER_HEIGHT;
		else this.player.position.y = maxY;

		const impactSpeed = Math.abs(this.velocity.dot(normal));
		if (this.isTargetStampSurface(normal) && this.velocity.length() > 2.8) {
			this.finishStampRebound(normal, 0.66, this.velocity.length());
		} else {
			const incomingSpeed = this.velocity.dot(normal);
			if (incomingSpeed < 0) this.velocity.addScaledVector(normal, -1.68 * incomingSpeed);
			this.joltRagdoll(0.9 + impactSpeed * 0.06);
			this.squash = Math.max(this.squash, 0.36);
		}
		if (Math.abs(normal.x) > 0.5) {
			this.velocity.x =
				normal.x * Math.max(Math.abs(this.velocity.x), POOPIE_MONSTER_BLOCK_KNOCKBACK);
			this.velocity.y = Math.max(this.velocity.y, 2.4);
		}
		return true;
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

	private shouldEnterUpstairsFromStairs() {
		return (
			this.playerLeftRoom === 'stairs' &&
			this.player.position.y >= UPSTAIRS_FLOOR_Y - 0.08 &&
			this.player.position.x <= UPSTAIRS_STAIRWELL_MAX_X + 0.12 &&
			this.player.position.x >= UPSTAIRS_STAIRWELL_MIN_X - PLAYER_RADIUS &&
			Math.abs(this.player.position.z - STAIR_TOP_Z) <= UPSTAIRS_STAIRWELL_HALF_Z - 0.08
		);
	}

	private isAtUpstairsStairOpening() {
		return (
			this.player.position.x <= UPSTAIRS_STAIRWELL_MAX_X + PLAYER_RADIUS * 0.7 &&
			this.player.position.x >= UPSTAIRS_STAIRWELL_MIN_X - PLAYER_RADIUS &&
			Math.abs(this.player.position.z - STAIR_TOP_Z) <= UPSTAIRS_STAIRWELL_HALF_Z - 0.12
		);
	}

	private getStairFloorHeight() {
		let floorHeight = 0;
		let nearestScore = Number.POSITIVE_INFINITY;
		const footprintMargin = PLAYER_RADIUS * 0.3;
		for (const step of this.stairSteps) {
			const dx = this.player.position.x - step.x;
			const dz = this.player.position.z - step.z;
			const cosine = Math.cos(step.rotationY);
			const sine = Math.sin(step.rotationY);
			const localX = dx * cosine - dz * sine;
			const localZ = dx * sine + dz * cosine;
			const halfLength = step.length / 2 + footprintMargin;
			const halfWidth = step.width / 2 + footprintMargin;
			if (Math.abs(localX) > halfLength || Math.abs(localZ) > halfWidth) continue;
			const score = Math.pow(localX / halfLength, 2) + Math.pow(localZ / halfWidth, 2);
			if (score >= nearestScore) continue;
			nearestScore = score;
			floorHeight = step.topY;
		}
		return floorHeight;
	}

	private getActiveFloorHeight() {
		if (this.playerInSewer) return SEWER_FLOOR_Y;
		if (this.playerInBasement) {
			return this.getBasementStairFloorHeight() ?? BASEMENT_FLOOR_Y;
		}
		if (this.playerUpstairs) return UPSTAIRS_FLOOR_Y;
		if (this.playerLeftRoom !== 'stairs') return 0;
		return this.getStairFloorHeight();
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
		this.syncGroundRoomVisibility();
		this.syncUpstairsVisibility();

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
		this.syncGroundRoomVisibility();
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
		this.playStampImpactSample(Math.min(1, speed / 7));
		this.cancelStamp();
		this.joltRagdoll(2.5);
		this.emitFeedback(
			door.room === 'stairs' ? 'DEUR OPEN! TRAP OMHOOG!' : `DEUR OPEN! ${door.label} IN!`
		);
		this.emitHud(true);
	}

	private setLeftRoomDoorCollisionEnabled(door: LeftRoomDoor, enabled: boolean) {
		for (const surface of door.surfaces) {
			if (enabled) {
				this.stampSurfaceKinds.set(surface, 'wall');
				this.bulletImpactSurfaceMaterials.set(surface, 'wood');
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
		this.playStampImpactSample(Math.min(1, speed / 7));
		this.finishStampRebound(wallNormal, 0.82, speed);
		this.joltRagdoll(2.6);
		this.emitFeedback('VEEL TE VEEL DIKKE SLOTEN!');
	}

	private performDoorStamp(speed: number) {
		this.breakContacts(0.16);
		this.doorOpen = true;
		this.doorDamage.visible = true;
		this.syncGroundRoomVisibility();
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
		this.playStampImpactSample(Math.min(1, speed / 7));
		this.cancelStamp();
		this.joltRagdoll(2.5);
		this.emitFeedback('DEUR OPEN! KEUKEN IN!');
		this.emitHud(true);
	}

	private setDoorCollisionEnabled(enabled: boolean) {
		for (const surface of this.doorStampSurfaces) {
			if (enabled) {
				this.stampSurfaceKinds.set(surface, 'wall');
				this.bulletImpactSurfaceMaterials.set(surface, 'wood');
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
		this.playStampImpactSample(Math.min(1, speed / 7));
		this.windowHits += 1;
		if (this.windowHits < WINDOW_STAMPS_REQUIRED) return false;

		this.windowBroken = true;
		this.windowBreakaway.visible = false;
		this.setWindowCollisionEnabled(false);
		this.clearWindowCracks();
		this.clearWindowBulletHoles();
		this.spawnWindowDebris();
		this.spawnWindowGarbagePile();
		this.audio.playVaseBreak();
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
		this.emitFeedback('RAAM ERAF! DE TUIN IN!');
		this.emitHud(true);
		return true;
	}

	private setWindowCollisionEnabled(enabled: boolean) {
		for (const surface of this.windowStampSurfaces) {
			if (enabled) {
				this.stampSurfaceKinds.set(surface, 'wall');
				this.bulletImpactSurfaceMaterials.set(surface, 'glass');
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
				life: 4 + Math.random() * 2,
				floorY: 0
			});
		}
	}

	private spawnWindowGarbagePile() {
		const geometries: THREE.BufferGeometry[] = [];
		const shardCount = this.reducedMotion ? 6 : 11;
		for (let index = 0; index < shardCount; index += 1) {
			const width = 0.1 + Math.random() * 0.3;
			const depth = 0.08 + Math.random() * 0.24;
			const geometry = new THREE.BoxGeometry(width, 0.018 + Math.random() * 0.022, depth);
			geometry.rotateX((Math.random() - 0.5) * 0.26);
			geometry.rotateY(Math.random() * Math.PI * 2);
			geometry.rotateZ((Math.random() - 0.5) * 0.22);
			geometry.translate(
				(Math.random() - 0.5) * (WINDOW_OPENING_WIDTH + 0.55),
				0.045 + Math.random() * 0.055,
				(Math.random() - 0.5) * 1.65
			);
			geometries.push(geometry);
		}

		const geometry = mergeGeometries(geometries, false);
		for (const shard of geometries) shard.dispose();
		if (!geometry) return;
		const mesh = new THREE.Mesh(
			geometry,
			new THREE.MeshStandardMaterial({
				color: 0x6f9eaa,
				roughness: 0.36,
				metalness: 0.06
			})
		);
		mesh.name = 'garbage-window-glass';
		mesh.position.set(WINDOW_CENTER_X, 0.012, BACK_WALL_Z);
		mesh.castShadow = !this.reducedMotion;
		mesh.receiveShadow = true;
		this.scene.add(mesh);
		this.garbagePiles.push({ mesh });
	}

	private isPlayerOverPoolInterior() {
		const pool = this.poolBreakable;
		if (!pool || pool.broken || !this.isBreakableActive(pool)) return false;
		return (
			Math.hypot(
				this.player.position.x - pool.group.position.x,
				this.player.position.z - pool.group.position.z
			) <= POOL_ENTRY_RADIUS
		);
	}

	private resolvePoolWaterContact(
		pool: Breakable,
		distance: number,
		previousBottom: number,
		delta: number
	) {
		const surfaceY = pool.group.position.y + POOL_WATER_Y;
		const bottomY = pool.group.position.y + POOL_BOTTOM_Y;
		const playerBottom = this.player.position.y;
		const playerTop = playerBottom + PLAYER_HEIGHT;
		const insideWater = distance <= POOL_ENTRY_RADIUS;

		if (!insideWater) {
			const stillAgainstInnerWall =
				this.rabbitInPoolWater &&
				playerBottom <= surfaceY + 0.12 &&
				distance <= pool.radius + PLAYER_RADIUS;
			if (stillAgainstInnerWall) {
				const nx = (this.player.position.x - pool.group.position.x) / Math.max(distance, 0.001);
				const nz = (this.player.position.z - pool.group.position.z) / Math.max(distance, 0.001);
				this.player.position.x = pool.group.position.x + nx * POOL_ENTRY_RADIUS;
				this.player.position.z = pool.group.position.z + nz * POOL_ENTRY_RADIUS;
				const outwardSpeed = this.velocity.x * nx + this.velocity.z * nz;
				if (outwardSpeed > 0) {
					this.velocity.x -= outwardSpeed * nx * 1.58;
					this.velocity.z -= outwardSpeed * nz * 1.58;
				}
				this.joltArms(0.55);
				return true;
			}
			this.rabbitInPoolWater = false;
			return false;
		}

		if (playerBottom > surfaceY) {
			if (this.rabbitInPoolWater && previousBottom <= surfaceY && this.velocity.y > 0) {
				this.spawnPoolSplash(Math.abs(this.velocity.y), 0.48);
			}
			this.rabbitInPoolWater = false;
			return true;
		}
		if (playerTop < bottomY) return false;

		if (previousBottom > surfaceY && this.velocity.y < 0) {
			this.spawnPoolSplash(Math.abs(this.velocity.y), 1);
		}
		this.rabbitInPoolWater = true;
		const submersion = THREE.MathUtils.clamp(
			(surfaceY - playerBottom) / Math.max(0.01, surfaceY - bottomY),
			0,
			1
		);
		const horizontalDrag = Math.exp(-(1.2 + submersion * 1.6) * delta);
		this.velocity.x *= horizontalDrag;
		this.velocity.z *= horizontalDrag;
		this.velocity.y *= Math.exp(-(0.45 + submersion * 0.7) * delta);
		this.velocity.y += submersion * 3.8 * delta;
		this.audio.playSwimming(
			submersion,
			Math.hypot(this.velocity.x, this.velocity.z, this.velocity.y * 0.35)
		);
		return true;
	}

	private performPoolStamp(speed: number) {
		this.spawnPoolSplash(speed, 1.35);
		if (this.poolBreakable && !this.poolBreakable.broken) {
			this.damageBreakable(this.poolBreakable, 'stamp');
		}
		this.rabbitInPoolWater = false;
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 0.82);
		this.playStampImpactSample(Math.min(1, speed / 20));
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
			if (
				breakable === this.poolBreakable &&
				this.resolvePoolWaterContact(breakable, distance, previousBottom, delta)
			) {
				continue;
			}
			const topContactRadius = breakable.radius + PLAYER_RADIUS * 0.56;
			const closeToTop = playerBottom >= objectTop - 0.12;
			const landingOnTop =
				!this.stomping &&
				this.velocity.y <= 0 &&
				distance <= topContactRadius &&
				previousBottom >= objectTop - 0.08 &&
				playerBottom <= objectTop + 0.16;
			if (landingOnTop) {
				const impactSpeed = Math.abs(this.velocity.y);
				this.player.position.y = objectTop;
				this.standRabbitUpright();
				this.velocity.y = Math.max(5.2, impactSpeed * 0.42);
				this.squash = Math.max(this.squash, Math.min(0.68, impactSpeed / 18));
				this.joltArms(0.9 + Math.min(impactSpeed, 12) * 0.07);
				this.audio.playCue('bounce');
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
		this.playStampImpactSample(Math.min(1, speed / 20));
	}

	private performWallStamp(speed: number, wallNormal: THREE.Vector3) {
		this.breakContacts(0.16);
		this.spawnSurfaceCrack(wallNormal, speed);
		this.squash = 1;
		this.cameraShake = Math.max(this.cameraShake, 0.72);
		this.playStampImpactSample(Math.min(1, speed / 7));
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
		if (feedback) this.emitFeedback(feedback);
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
				spawnDelay: 0,
				canFeedPoopieMonster: index === 0
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
		this.audio.playFart();
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
			this.emitFeedback(
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
		this.toiletFloorPlug.visible = false;
		this.toiletHole.visible = true;
		this.breakObject(this.toiletBreakable, 'sink');
		this.cameraShake = Math.max(this.cameraShake, 1.05);
		this.emitFeedback('WC TE VOL! HET RIOOL GAAT OPEN!');
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

	private tryHitPoopieMonster(projectile: WeaponProjectile) {
		if (
			projectile.kind !== 'poop' ||
			!projectile.canFeedPoopieMonster ||
			!this.playerInSewer ||
			this.poopieMonsterState !== 'neutral'
		) {
			return false;
		}

		const position = projectile.mesh.position;
		if (
			position.x < POOPIE_MONSTER_X - POOPIE_MONSTER_FEED_DISTANCE ||
			position.x > POOPIE_MONSTER_X - POOPIE_MONSTER_RADIUS * 0.25 ||
			position.y < SEWER_FLOOR_Y ||
			position.y > SEWER_FLOOR_Y + POOPIE_MONSTER_FEED_HEIGHT ||
			Math.abs(position.z - SEWER_CENTER_Z) > SEWER_DEPTH / 2 - 0.08
		) {
			return false;
		}

		this.hitPoopieMonster('poop');
		return true;
	}

	private hitPoopieMonster(hitKind: 'bullet' | 'poop') {
		if (this.poopieMonsterState !== 'neutral') return;
		this.poopieMonsterHitFlash = 0.2;
		this.cameraShake = Math.max(this.cameraShake, hitKind === 'bullet' ? 0.25 : 0.14);

		if (hitKind === 'bullet') {
			this.poopieMonsterHealth -= 1;
			this.updatePoopieMonsterStatus();
			if (this.poopieMonsterHealth <= 0) {
				this.poopieMonsterState = 'dead';
				this.poopieMonsterDeathInProgress = true;
				this.poopieMonsterDeathProgress = 0;
				this.poopieMonsterDeathStartY = this.poopieMonsterPose.position.y;
				this.poopieMonsterDeathStartRotation = this.poopieMonsterPose.rotation.z;
				this.poopieMonsterDeathStartScale.copy(this.poopieMonsterPose.scale);
				this.audio.playPoopieMonsterDeath();
				this.cameraShake = Math.max(this.cameraShake, 0.72);
			} else {
				this.audio.playBulletImpact('body');
				this.audio.playPoopieMonsterHit();
			}
			return;
		}

		this.poopieMonsterPoopHits += 1;
		this.updatePoopieMonsterStatus();
		this.audio.playPoopieMonsterEat();
		if (this.poopieMonsterPoopHits >= POOPIE_MONSTER_POOP_HITS) {
			this.poopieMonsterState = 'friend';
			if (this.poopieMonsterHeart) this.poopieMonsterHeart.visible = true;
			this.audio.playPoopieMonsterFriend();
		}
	}

	private updatePoopieMonster(delta: number) {
		this.poopieMonsterTime += delta;
		this.updatePoopieMonsterSpeech();
		this.poopieMonsterHitFlash = Math.max(0, this.poopieMonsterHitFlash - delta);
		const flash = this.poopieMonsterHitFlash / 0.2;
		for (const poopieMaterial of this.poopieMonsterMaterials) {
			poopieMaterial.emissive.setHex(flash > 0 ? 0x8a2112 : 0x140906);
			poopieMaterial.emissiveIntensity = 0.08 + flash * 1.35;
		}

		const response = 1 - Math.exp(-7 * delta);
		if (this.poopieMonsterWarning) {
			this.poopieMonsterWarning.visible =
				this.poopieMonsterState === 'neutral' && !this.sewerIntroPlayed;
		}
		if (this.poopieMonsterIntroLines) {
			this.poopieMonsterIntroLines.visible = this.sewerIntroActive;
			const linesMaterial = this.poopieMonsterIntroLines.material;
			linesMaterial.rotation = this.reducedMotion ? 0 : this.sewerIntroTime * 0.025;
		}
		if (this.poopieMonsterStatus) {
			this.poopieMonsterStatus.visible = this.sewerIntroPlayed && !this.sewerIntroActive;
		}
		if (this.poopieMonsterState === 'dead') {
			if (this.poopieMonsterDeathInProgress) {
				this.poopieMonsterDeathProgress = Math.min(
					1,
					this.poopieMonsterDeathProgress + delta / POOPIE_MONSTER_DEATH_DURATION
				);
				const progress = this.poopieMonsterDeathProgress;
				const fallProgress = THREE.MathUtils.clamp((progress - 0.08) / 0.92, 0, 1);
				const fallEase = fallProgress * fallProgress * fallProgress;
				const recoilLift = Math.sin(progress * Math.PI) * (1 - fallProgress) * 0.16;
				this.poopieMonsterPose.rotation.z = THREE.MathUtils.lerp(
					this.poopieMonsterDeathStartRotation,
					-Math.PI / 2,
					fallEase
				);
				this.poopieMonsterPose.rotation.x = Math.sin(fallProgress * Math.PI) * 0.1;
				this.poopieMonsterPose.position.y =
					THREE.MathUtils.lerp(
						this.poopieMonsterDeathStartY,
						POOPIE_MONSTER_DEATH_GROUND_Y,
						fallEase
					) + recoilLift;
				this.poopieMonsterPose.scale.set(
					THREE.MathUtils.lerp(this.poopieMonsterDeathStartScale.x, 1, fallProgress),
					THREE.MathUtils.lerp(this.poopieMonsterDeathStartScale.y, 1, fallProgress),
					THREE.MathUtils.lerp(this.poopieMonsterDeathStartScale.z, 1, fallProgress)
				);

				if (progress >= 1) {
					this.poopieMonsterDeathInProgress = false;
					this.poopieMonsterPose.rotation.set(0, 0, -Math.PI / 2);
					this.poopieMonsterPose.position.y = POOPIE_MONSTER_DEATH_GROUND_Y;
					this.poopieMonsterPose.scale.set(1.13, 0.82, 1.1);
					this.audio.playPoopieMonsterDeathThud();
					this.cameraShake = Math.max(this.cameraShake, 1.35);
					this.joltRagdoll(2.2);
					this.spawnImpactRing(1.45, this.poopieMonsterRoot.position, 0x5b3022);
					this.spawnImpactRing(0.92, this.poopieMonsterRoot.position, 0x1c0f0b);
				}
			} else {
				this.poopieMonsterPose.rotation.set(0, 0, -Math.PI / 2);
				this.poopieMonsterPose.position.y = POOPIE_MONSTER_DEATH_GROUND_Y;
				this.poopieMonsterPose.scale.set(
					THREE.MathUtils.lerp(this.poopieMonsterPose.scale.x, 1, response),
					THREE.MathUtils.lerp(this.poopieMonsterPose.scale.y, 1, response),
					THREE.MathUtils.lerp(this.poopieMonsterPose.scale.z, 1, response)
				);
			}
			if (this.poopieMonsterHeart) this.poopieMonsterHeart.visible = false;
			return;
		}

		const friendly = this.poopieMonsterState === 'friend';
		const motion = this.reducedMotion ? 0 : 1;
		const breath = Math.sin(this.poopieMonsterTime * (friendly ? 2.2 : 1.55)) * 0.012 * motion;
		this.poopieMonsterPose.position.y = 0;
		this.poopieMonsterPose.scale.set(1 - breath * 0.2, 1 + breath, 1 - breath * 0.2);
		this.poopieMonsterPose.rotation.z =
			Math.sin(this.poopieMonsterTime * (friendly ? 3.1 : 1.5)) *
			(friendly ? 0.04 : 0.018) *
			motion;
		const armWave =
			Math.sin(this.poopieMonsterTime * (friendly ? 6.2 : 2.4)) * (friendly ? 0.34 : 0.07) * motion;
		if (this.poopieMonsterArms[0]) this.poopieMonsterArms[0].rotation.z = 0.82 + armWave;
		if (this.poopieMonsterArms[1]) this.poopieMonsterArms[1].rotation.z = -0.82 - armWave;

		if (this.poopieMonsterHeart) {
			this.poopieMonsterHeart.visible = friendly;
			this.poopieMonsterHeart.position.y =
				POOPIE_MONSTER_HEIGHT + 0.38 + Math.sin(this.poopieMonsterTime * 3.8) * 0.06 * motion;
			const pulse = 0.32 * (1 + Math.sin(this.poopieMonsterTime * 4.8) * 0.08 * motion);
			this.poopieMonsterHeart.scale.setScalar(pulse);
		}
	}

	private resetPoopieMonster() {
		this.audio.stopPoopieMonsterSpeech();
		this.poopieMonsterSpeechArmed = true;
		this.sewerIntroActive = false;
		this.sewerIntroPlayed = false;
		this.sewerIntroAudioPlayed = false;
		this.sewerIntroTime = 0;
		this.events.emit('sewerIntro', { active: false });
		this.poopieMonsterState = 'neutral';
		this.poopieMonsterHealth = POOPIE_MONSTER_BULLET_HITS;
		this.poopieMonsterPoopHits = 0;
		this.updatePoopieMonsterStatus();
		this.poopieMonsterTime = 0;
		this.poopieMonsterHitFlash = 0;
		this.poopieMonsterDeathInProgress = false;
		this.poopieMonsterDeathProgress = 0;
		this.poopieMonsterDeathStartY = 0;
		this.poopieMonsterDeathStartRotation = 0;
		this.poopieMonsterDeathStartScale.set(1, 1, 1);
		this.poopieMonsterRoot.position.set(POOPIE_MONSTER_X, SEWER_FLOOR_Y, SEWER_CENTER_Z);
		this.poopieMonsterPose.position.set(0, 0, 0);
		this.poopieMonsterPose.rotation.set(0, 0, 0);
		this.poopieMonsterPose.scale.setScalar(1);
		if (this.poopieMonsterArms[0]) this.poopieMonsterArms[0].rotation.z = 0.82;
		if (this.poopieMonsterArms[1]) this.poopieMonsterArms[1].rotation.z = -0.82;
		if (this.poopieMonsterHeart) {
			this.poopieMonsterHeart.visible = false;
			this.poopieMonsterHeart.position.set(0, POOPIE_MONSTER_HEIGHT + 0.38, 0.58);
			this.poopieMonsterHeart.scale.setScalar(0.32);
		}
		if (this.poopieMonsterWarning) this.poopieMonsterWarning.visible = true;
		if (this.poopieMonsterStatus) this.poopieMonsterStatus.visible = false;
		if (this.poopieMonsterIntroLines) this.poopieMonsterIntroLines.visible = false;
		for (const poopieMaterial of this.poopieMonsterMaterials) {
			poopieMaterial.emissive.setHex(0x140906);
			poopieMaterial.emissiveIntensity = 0.08;
		}
	}

	private fireGun(weapon: GunWeapon) {
		const muzzle = weapon === 'g36' ? this.g36Muzzle : this.pistolMuzzle;
		const pivot = weapon === 'g36' ? this.g36Pivot : this.pistolPivot;
		const origin = muzzle
			? muzzle.getWorldPosition(new THREE.Vector3())
			: this.player.position.clone().add(new THREE.Vector3(0, 0.82, 0));
		const direction = muzzle
			? new THREE.Vector3(0, 0, 1)
					.applyQuaternion(muzzle.getWorldQuaternion(new THREE.Quaternion()))
					.normalize()
			: new THREE.Vector3(0, 0, 1).applyQuaternion(
					this.player.getWorldQuaternion(new THREE.Quaternion())
				);
		this.spawnMuzzleEffects(origin, direction, muzzle ?? undefined);

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

		const barrelLength = pivot
			? pivot.getWorldPosition(new THREE.Vector3()).distanceTo(origin)
			: BULLET_HALF_LENGTH * 2;
		const probeOrigin = origin.clone().addScaledVector(direction, -barrelLength);
		const probeDistance = barrelLength + BULLET_HALF_LENGTH * 2;
		const immediateSurfaceHit = this.findSurfaceHit(probeOrigin, direction, probeDistance);
		const immediateObjectHit = this.findBreakableHit(probeOrigin, direction, probeDistance);
		const immediateMonsterHit = this.findPoopieMonsterHit(probeOrigin, direction, probeDistance);
		if (
			immediateMonsterHit &&
			(!immediateSurfaceHit || immediateMonsterHit.distance < immediateSurfaceHit.distance) &&
			(!immediateObjectHit || immediateMonsterHit.distance < immediateObjectHit.distance)
		) {
			bullet.geometry.dispose();
			bullet.material.dispose();
			this.hitPoopieMonster('bullet');
		} else if (
			immediateObjectHit &&
			(!immediateSurfaceHit || immediateObjectHit.distance < immediateSurfaceHit.distance)
		) {
			bullet.geometry.dispose();
			bullet.material.dispose();
			this.audio.playBulletImpact(
				this.getBreakableBulletImpactMaterial(
					immediateObjectHit.breakable,
					immediateObjectHit.point,
					direction
				)
			);
			this.damageBreakable(immediateObjectHit.breakable, 'bullet');
		} else if (immediateSurfaceHit) {
			bullet.geometry.dispose();
			bullet.material.dispose();
			this.spawnBulletHole(immediateSurfaceHit.point, immediateSurfaceHit.normal);
			this.audio.playBulletImpact(
				this.bulletImpactSurfaceMaterials.get(immediateSurfaceHit.object) ?? 'concrete'
			);
		} else {
			this.scene.add(bullet);
			this.weaponProjectiles.push({
				mesh: bullet,
				velocity: direction.clone().multiplyScalar(BULLET_SPEED),
				life: BULLET_LIFETIME,
				kind: weapon,
				spawnDelay: weapon === 'g36' ? 0.01 : PISTOL_SPAWN_DELAY
			});
		}

		const recoil = weapon === 'g36' ? 2.15 : 5.8;
		this.velocity.addScaledVector(direction, -recoil);
		this.velocity.clampLength(0, 17);
		this.joltRagdoll(weapon === 'g36' ? 3.2 : 5.8);
		this.cameraShake = Math.max(this.cameraShake, weapon === 'g36' ? 0.34 : 0.52);
		this.audio.playGunshot(weapon);
	}

	private spawnMuzzleEffects(
		origin: THREE.Vector3,
		direction: THREE.Vector3,
		muzzle?: THREE.Object3D
	) {
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

		const flashLight = this.muzzleLight;
		flashLight.position.copy(origin).addScaledVector(direction, 0.045);
		flashLight.intensity = 105 + Math.random() * 20;
		const activeLightEffect = this.muzzleLightEffects[0];
		if (activeLightEffect) {
			activeLightEffect.life = 0.11;
			activeLightEffect.maxLife = 0.11;
			activeLightEffect.intensity = flashLight.intensity;
		} else {
			this.muzzleLightEffects.push({
				light: flashLight,
				life: 0.11,
				maxLife: 0.11,
				intensity: flashLight.intensity
			});
		}

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
				followMuzzleUntilVisible: delay > 0,
				muzzle
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

	private async prepareWeaponEffects() {
		if (this.weaponWarmupRoot) return;

		const glowTexture = this.getMuzzleGlowTexture();
		const smokeTexture = this.getMuzzleSmokeTexture();
		this.renderer.initTexture(glowTexture);
		this.renderer.initTexture(smokeTexture);

		const warmupRoot = new THREE.Group();
		const flash = new THREE.Mesh(
			new THREE.ConeGeometry(0.09, 0.34, 7),
			new THREE.MeshBasicMaterial({
				color: 0xffd98a,
				transparent: true,
				opacity: 0.76,
				depthTest: false,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				toneMapped: false
			})
		);
		const glow = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: glowTexture,
				transparent: true,
				depthTest: false,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				toneMapped: false
			})
		);
		const smoke = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: smokeTexture,
				transparent: true,
				depthTest: false,
				depthWrite: false,
				toneMapped: false
			})
		);
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
		warmupRoot.add(flash, glow, smoke, bullet);
		this.weaponWarmupRoot = warmupRoot;

		try {
			await this.renderer.compileAsync(warmupRoot, this.camera, this.scene);
		} catch (error) {
			console.warn('Weapon effect shader warmup failed; effects will compile on demand.', error);
		}
	}

	private disposeWeaponWarmupResources() {
		if (!this.weaponWarmupRoot) return;
		this.weaponWarmupRoot.traverse((child) => {
			if (child instanceof THREE.Mesh) child.geometry.dispose();
			if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
				const childMaterial = child.material;
				if (Array.isArray(childMaterial)) childMaterial.forEach((item) => item.dispose());
				else childMaterial.dispose();
			}
		});
		this.weaponWarmupRoot = null;
	}

	private updateMuzzleEffects(delta: number) {
		for (let index = this.muzzleLightEffects.length - 1; index >= 0; index -= 1) {
			const effect = this.muzzleLightEffects[index];
			effect.life -= delta;
			const lifeRatio = Math.max(0, effect.life / effect.maxLife);
			effect.light.intensity = effect.intensity * lifeRatio * lifeRatio;
			if (effect.life <= 0) {
				effect.light.intensity = 0;
				this.muzzleLightEffects.splice(index, 1);
			}
		}

		for (let index = this.muzzleEffects.length - 1; index >= 0; index -= 1) {
			const effect = this.muzzleEffects[index];
			if (effect.delay > 0) {
				effect.delay -= delta;
				if (effect.followMuzzleUntilVisible && effect.muzzle) {
					effect.muzzle.updateWorldMatrix(true, false);
					effect.mesh.position.copy(effect.muzzle.getWorldPosition(this.muzzleWorldPosition));
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
		return { point: hit.point.clone(), normal, distance: hit.distance, object: hit.object };
	}

	private getBreakableBulletImpactMaterial(
		breakable: Breakable,
		point: THREE.Vector3,
		direction: THREE.Vector3
	): BulletImpactMaterial {
		if (
			breakable === this.poolBreakable &&
			direction.y < -0.15 &&
			Math.hypot(point.x - breakable.group.position.x, point.z - breakable.group.position.z) <=
				POOL_WATER_RADIUS + 0.12
		) {
			return 'water';
		}

		switch (breakable.material) {
			case 'ceramic':
				return 'glass';
			case 'wood':
				return 'wood';
			case 'metal':
			case 'electronics':
				return 'metal';
			case 'plant':
				return 'grass';
			case 'canvas':
				return 'land';
		}
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

	private findPoopieMonsterHit(origin: THREE.Vector3, direction: THREE.Vector3, distance: number) {
		if (!this.playerInSewer || this.poopieMonsterState !== 'neutral') return null;
		const hitBox = new THREE.Box3(
			new THREE.Vector3(
				POOPIE_MONSTER_X - POOPIE_MONSTER_RADIUS,
				SEWER_FLOOR_Y,
				SEWER_CENTER_Z - POOPIE_MONSTER_RADIUS - 0.15
			),
			new THREE.Vector3(
				POOPIE_MONSTER_X + POOPIE_MONSTER_RADIUS,
				SEWER_FLOOR_Y + POOPIE_MONSTER_HEIGHT + POOPIE_MONSTER_HITBOX_TOP_PADDING,
				SEWER_CENTER_Z + POOPIE_MONSTER_RADIUS + 0.15
			)
		);
		const point = new THREE.Ray(origin, direction).intersectBox(hitBox, new THREE.Vector3());
		if (!point) return null;
		const hitDistance = origin.distanceTo(point);
		return hitDistance <= distance ? { point, distance: hitDistance } : null;
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
		if (source === 'stamp') {
			this.playStampImpactSample(Math.min(1, this.velocity.length() / 12));
		}
		if (breakable === this.kitchenHatchBreakable) {
			if (source === 'bullet') {
				this.emitFeedback('DIT LUIK MOET JE STAMPEN!');
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
				this.emitFeedback('NIET SCHIETEN. SCHIJTEN!');
			}
			return;
		}
		if (breakable.stampsRequired <= 1) {
			this.breakObject(breakable);
			return;
		}

		if (source === 'bullet') {
			this.emitFeedback(`${breakable.label} MOET JE STAMPEN!`);
			return;
		}
		if (breakable.lastStampSequence === this.stampSequence) return;

		breakable.lastStampSequence = this.stampSequence;
		breakable.stampCount += 1;
		if (breakable.stampCount >= breakable.stampsRequired) {
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
		if (breakable === this.poolBreakable) this.rabbitInPoolWater = false;
		breakable.group.visible = effect === 'sink';
		const points = breakable.value;
		this.score += points;
		this.destroyedCount += 1;
		this.lastHit = breakable.label;
		this.lastValue = points;
		if (effect === 'smash') this.spawnDebris(breakable);
		this.spawnGarbagePile(breakable);
		if (breakable === this.poolBreakable) this.spawnPoolPuddle(breakable);
		this.events.emit('impact', { label: breakable.label, value: points });
		if (breakable === this.gunRackBreakable) this.dropG36Pickup();
		this.audio.playBreak(breakable.material, breakable.label);
		this.cameraShake = Math.max(this.cameraShake, 0.42);
		this.emitHud(true);
		if (supportedObject) this.breakObject(supportedObject);

		if (this.phase === 'playing' && this.destroyedCount === this.breakables.length) {
			this.phase = 'finished';
			this.weaponHeld = false;
			this.velocity.set(0, 0, 0);
			this.audio.playCue('finish');
			this.emitHud(true);
		}
	}

	private spawnDebris(breakable: Breakable) {
		const pieces = this.reducedMotion ? 5 : 10;
		const floorY = this.getBreakableFloorY(breakable);
		const debrisParent = this.getBreakableSceneRoot(breakable);
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
			debrisParent.add(mesh);
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
				life: 5 + Math.random() * 2,
				floorY
			});
		}
	}

	private spawnGarbagePile(breakable: Breakable) {
		const shardProfiles: Record<
			BreakMaterial,
			{ width: [number, number]; height: [number, number]; depth: [number, number] }
		> = {
			ceramic: { width: [0.12, 0.34], height: [0.025, 0.075], depth: [0.1, 0.28] },
			wood: { width: [0.3, 0.72], height: [0.055, 0.14], depth: [0.08, 0.2] },
			metal: { width: [0.18, 0.52], height: [0.07, 0.2], depth: [0.14, 0.38] },
			plant: { width: [0.26, 0.68], height: [0.04, 0.11], depth: [0.055, 0.15] },
			electronics: { width: [0.18, 0.48], height: [0.055, 0.16], depth: [0.12, 0.34] },
			canvas: { width: [0.3, 0.74], height: [0.025, 0.075], depth: [0.07, 0.18] }
		};
		const profile = shardProfiles[breakable.material];
		const scale = THREE.MathUtils.clamp(
			0.7 + breakable.radius * 0.28 + breakable.height * 0.07,
			0.78,
			1.38
		);
		const spread = THREE.MathUtils.clamp(
			breakable.radius * 0.72 + breakable.height * 0.07,
			0.38,
			1.42
		);
		const targetCount = THREE.MathUtils.clamp(
			Math.round(5 + breakable.radius * 2 + breakable.height * 0.45),
			6,
			10
		);
		const shardCount = this.reducedMotion ? Math.min(5, targetCount) : targetCount;
		const geometries: THREE.BufferGeometry[] = [];
		const keepsCenterClear =
			breakable === this.kitchenHatchBreakable || breakable === this.toiletBreakable;
		const randomBetween = ([minimum, maximum]: [number, number]) =>
			THREE.MathUtils.lerp(minimum, maximum, Math.random()) * scale;

		for (let index = 0; index < shardCount; index += 1) {
			const width = randomBetween(profile.width);
			const height = randomBetween(profile.height);
			const depth = randomBetween(profile.depth);
			const angle = Math.random() * Math.PI * 2;
			const minimumRadius = keepsCenterClear ? spread * 0.62 : 0;
			const radius = THREE.MathUtils.lerp(minimumRadius, spread, Math.sqrt(Math.random()));
			const geometry = new THREE.BoxGeometry(width, height, depth);
			geometry.rotateX((Math.random() - 0.5) * 0.34);
			geometry.rotateY(angle + (Math.random() - 0.5) * 1.1);
			geometry.rotateZ((Math.random() - 0.5) * 0.28);
			geometry.translate(
				Math.cos(angle) * radius,
				height * 0.8 + Math.random() * 0.065,
				Math.sin(angle) * radius
			);

			const pieceColor = breakable.color
				.clone()
				.offsetHSL(
					(Math.random() - 0.5) * 0.055,
					-Math.random() * 0.08,
					-0.16 + Math.random() * 0.2
				);
			const vertexCount = geometry.getAttribute('position').count;
			const colors = new Float32Array(vertexCount * 3);
			for (let vertex = 0; vertex < vertexCount; vertex += 1) {
				colors[vertex * 3] = pieceColor.r;
				colors[vertex * 3 + 1] = pieceColor.g;
				colors[vertex * 3 + 2] = pieceColor.b;
			}
			geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
			geometries.push(geometry);
		}

		const geometry = mergeGeometries(geometries, false);
		for (const shard of geometries) shard.dispose();
		if (!geometry) return;
		geometry.computeBoundingSphere();
		const mesh = new THREE.Mesh(
			geometry,
			new THREE.MeshStandardMaterial({
				color: 0xf7f3e9,
				vertexColors: true,
				roughness: breakable.material === 'metal' ? 0.58 : 0.88,
				metalness:
					breakable.material === 'metal' ? 0.34 : breakable.material === 'electronics' ? 0.12 : 0
			})
		);
		mesh.name = `garbage-${breakable.label.toLowerCase().replaceAll(' ', '-')}`;
		mesh.position.set(
			breakable.group.position.x,
			this.getBreakableFloorY(breakable) + 0.012,
			breakable.group.position.z
		);
		mesh.castShadow = !this.reducedMotion;
		mesh.receiveShadow = true;
		this.getBreakableSceneRoot(breakable).add(mesh);
		this.garbagePiles.push({ mesh });
	}

	private spawnPoolPuddle(pool: Breakable) {
		const outline = new THREE.Shape();
		const pointCount = 28;
		for (let index = 0; index < pointCount; index += 1) {
			const angle = (index / pointCount) * Math.PI * 2;
			const wobble = 0.9 + Math.sin(angle * 3 + 0.6) * 0.08 + Math.sin(angle * 7 - 0.35) * 0.045;
			const x = Math.cos(angle) * POOL_WATER_RADIUS * 1.2 * wobble;
			const z = Math.sin(angle) * POOL_WATER_RADIUS * 0.92 * wobble;
			if (index === 0) outline.moveTo(x, z);
			else outline.lineTo(x, z);
		}
		outline.closePath();

		const puddle = new THREE.Mesh(
			new THREE.ShapeGeometry(outline),
			new THREE.MeshPhysicalMaterial({
				color: 0x49bfd2,
				emissive: 0x073f49,
				emissiveIntensity: 0.12,
				roughness: 0.12,
				metalness: 0.02,
				clearcoat: 1,
				clearcoatRoughness: 0.16,
				transparent: true,
				opacity: 0.68,
				depthWrite: false,
				side: THREE.DoubleSide,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				polygonOffsetUnits: -2
			})
		);
		puddle.name = 'garbage-pool-puddle';
		puddle.rotation.x = -Math.PI / 2;
		puddle.position.set(
			pool.group.position.x,
			this.getBreakableFloorY(pool) + 0.022,
			pool.group.position.z
		);
		puddle.renderOrder = 1;
		this.getBreakableSceneRoot(pool).add(puddle);
		this.garbagePiles.push({ mesh: puddle });
	}

	private getBreakableFloorY(breakable: Breakable) {
		if (this.upstairsBreakables.includes(breakable)) return UPSTAIRS_FLOOR_Y;
		if (breakable.biome === 'basement') return BASEMENT_FLOOR_Y;
		if (breakable.biome === 'sewer') return SEWER_FLOOR_Y;
		return 0;
	}

	private getBreakableSceneRoot(breakable: Breakable): THREE.Object3D {
		if (this.upstairsBreakables.includes(breakable)) return this.upstairsRoot;
		if (breakable.biome === 'basement') return this.basementRoot;
		if (breakable.biome === 'sewer') return this.sewerRoot;

		const position = breakable.basePosition;
		if (
			position.x >= KITCHEN_MIN_X &&
			position.x <= KITCHEN_MAX_X &&
			position.z >= BACK_WALL_Z &&
			position.z <= ROOM_DEPTH / 2
		) {
			return this.kitchenInteriorRoot;
		}
		if (
			position.x >= LEFT_ROOMS_MIN_X &&
			position.x <= LEFT_ROOMS_MAX_X &&
			position.z >= BACK_WALL_Z &&
			position.z <= ROOM_DEPTH / 2
		) {
			const room: LeftRoomName =
				position.z < BATHROOM_MAX_Z
					? 'bathroom'
					: position.z < BEDROOM_MIN_Z
						? 'stairs'
						: 'bedroom';
			return this.leftRoomInteriorRoots.get(room) ?? this.scene;
		}
		return this.scene;
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

			if (piece.mesh.position.y < piece.floorY + 0.08) {
				piece.mesh.position.y = piece.floorY + 0.08;
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
				piece.mesh.removeFromParent();
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
			if (projectile.kind !== 'poop') {
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
					const monsterHit = this.findPoopieMonsterHit(rayOrigin, direction, collisionDistance);
					if (
						monsterHit &&
						(!surfaceHit || monsterHit.distance < surfaceHit.distance) &&
						(!objectHit || monsterHit.distance < objectHit.distance)
					) {
						this.hitPoopieMonster('bullet');
						this.removeWeaponProjectile(index);
						continue;
					}
					if (
						objectHit &&
						(!surfaceHit || objectHit.distance < surfaceHit.distance) &&
						(!monsterHit || objectHit.distance < monsterHit.distance)
					) {
						this.audio.playBulletImpact(
							this.getBreakableBulletImpactMaterial(objectHit.breakable, objectHit.point, direction)
						);
						this.damageBreakable(objectHit.breakable, 'bullet');
						this.removeWeaponProjectile(index);
						continue;
					}
					if (surfaceHit) {
						this.spawnBulletHole(surfaceHit.point, surfaceHit.normal);
						this.audio.playBulletImpact(
							this.bulletImpactSurfaceMaterials.get(surfaceHit.object) ?? 'concrete'
						);
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
				if (this.tryHitPoopieMonster(projectile)) {
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

	private spawnImpactRing(
		radius: number,
		position: THREE.Vector3 = this.player.position,
		color: THREE.ColorRepresentation = COLORS.cream
	) {
		const ringMaterial = new THREE.MeshBasicMaterial({
			color,
			transparent: true,
			opacity: 0.9,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 48), ringMaterial);
		ring.rotation.x = -Math.PI / 2;
		ring.position.set(position.x, this.getActiveFloorHeight() + 0.035, position.z);
		ring.scale.setScalar(0.4);
		this.scene.add(ring);
		this.impactRings.push({ mesh: ring, life: Math.max(0.35, radius * 0.19) });
	}

	private spawnPoolSplash(impactSpeed: number, strengthScale: number) {
		const pool = this.poolBreakable;
		if (!pool || pool.broken || this.poolSplashCooldown > 0) return;
		const intensity = THREE.MathUtils.clamp((impactSpeed / 10) * strengthScale, 0.32, 1.35);
		const surfaceY = pool.group.position.y + POOL_WATER_Y;
		const offset = new THREE.Vector2(
			this.player.position.x - pool.group.position.x,
			this.player.position.z - pool.group.position.z
		);
		if (offset.length() > POOL_ENTRY_RADIUS * 0.88) offset.setLength(POOL_ENTRY_RADIUS * 0.88);
		const splashX = pool.group.position.x + offset.x;
		const splashZ = pool.group.position.z + offset.y;

		const rippleCount = this.reducedMotion ? 1 : 2;
		for (let index = 0; index < rippleCount; index += 1) {
			const maxLife = 0.48 + index * 0.14;
			const ripple = new THREE.Mesh(
				new THREE.RingGeometry(0.68, 0.82, 40),
				new THREE.MeshBasicMaterial({
					color: index === 0 ? 0xc9f5f4 : 0x71ddeb,
					transparent: true,
					opacity: 0.7 - index * 0.16,
					side: THREE.DoubleSide,
					depthWrite: false,
					blending: THREE.AdditiveBlending
				})
			);
			ripple.rotation.x = -Math.PI / 2;
			ripple.position.set(splashX, surfaceY + 0.018 + index * 0.004, splashZ);
			ripple.scale.setScalar(0.09 + index * 0.06);
			ripple.renderOrder = 3;
			this.scene.add(ripple);
			this.waterRipples.push({
				mesh: ripple,
				life: maxLife,
				maxLife,
				expansion: (1.65 + intensity * 0.85) * (1 - index * 0.16)
			});
		}

		const dropletCount = this.reducedMotion ? 4 : Math.round(7 + intensity * 8);
		for (let index = 0; index < dropletCount; index += 1) {
			const droplet = new THREE.Mesh(
				new THREE.SphereGeometry(0.025 + Math.random() * 0.025, 7, 5),
				new THREE.MeshStandardMaterial({
					color: index % 3 === 0 ? 0xd1f7f4 : 0x67d7e8,
					roughness: 0.18,
					transparent: true,
					opacity: 0.82
				})
			);
			const angle = Math.random() * Math.PI * 2;
			const radialSpeed = 0.8 + Math.random() * (1.4 + intensity * 1.4);
			const maxLife = 0.5 + Math.random() * 0.32;
			droplet.position.set(
				splashX + Math.cos(angle) * Math.random() * 0.16,
				surfaceY + 0.035,
				splashZ + Math.sin(angle) * Math.random() * 0.16
			);
			droplet.scale.set(0.72, 1.45 + Math.random() * 0.55, 0.72);
			this.scene.add(droplet);
			this.waterDroplets.push({
				mesh: droplet,
				velocity: new THREE.Vector3(
					Math.cos(angle) * radialSpeed,
					2.1 + Math.random() * (2.2 + intensity * 1.5),
					Math.sin(angle) * radialSpeed
				),
				life: maxLife,
				maxLife
			});
		}

		this.poolWaveEnergy = Math.max(this.poolWaveEnergy, intensity);
		this.poolSplashCooldown = 0.11;
		this.audio.playWaterSplash(impactSpeed * strengthScale);
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

		strokePaths('rgba(0, 0, 0, 0.9)', emphasizeWindow ? 3.2 : 1.8 + strength * 1.2);

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

	private updatePoolWater(delta: number) {
		this.poolWaterTime += delta;
		this.poolWaveEnergy *= Math.exp(-2.4 * delta);
		if (this.poolWater && this.poolWaterBasePositions && !this.poolBreakable?.broken) {
			const position = this.poolWater.geometry.getAttribute('position');
			const amplitude = 0.008 + this.poolWaveEnergy * 0.036;
			for (let index = 0; index < position.count; index += 1) {
				const offset = index * 3;
				const x = this.poolWaterBasePositions[offset];
				const y = this.poolWaterBasePositions[offset + 1];
				const wave =
					Math.sin(x * 3.4 + this.poolWaterTime * 2.7) * 0.58 +
					Math.cos(y * 4.1 - this.poolWaterTime * 2.15) * 0.42;
				position.setZ(index, wave * amplitude);
			}
			position.needsUpdate = true;
			this.poolWater.geometry.computeVertexNormals();
		}

		for (let index = this.waterRipples.length - 1; index >= 0; index -= 1) {
			const ripple = this.waterRipples[index];
			ripple.life -= delta;
			ripple.mesh.scale.addScalar(ripple.expansion * delta);
			const lifeRatio = Math.max(0, ripple.life / ripple.maxLife);
			ripple.mesh.material.opacity = Math.pow(lifeRatio, 1.4) * 0.68;
			if (ripple.life <= 0) {
				this.scene.remove(ripple.mesh);
				ripple.mesh.geometry.dispose();
				ripple.mesh.material.dispose();
				this.waterRipples.splice(index, 1);
			}
		}

		const surfaceY = (this.poolBreakable?.group.position.y ?? 0) + POOL_WATER_Y;
		for (let index = this.waterDroplets.length - 1; index >= 0; index -= 1) {
			const droplet = this.waterDroplets[index];
			droplet.life -= delta;
			droplet.velocity.y -= 9.8 * delta;
			droplet.mesh.position.addScaledVector(droplet.velocity, delta);
			droplet.mesh.rotation.x += delta * 4.2;
			const lifeRatio = Math.max(0, droplet.life / droplet.maxLife);
			droplet.mesh.material.opacity = Math.min(0.82, lifeRatio * 1.2);
			if (droplet.life <= 0 || (droplet.velocity.y < 0 && droplet.mesh.position.y <= surfaceY)) {
				this.scene.remove(droplet.mesh);
				droplet.mesh.geometry.dispose();
				droplet.mesh.material.dispose();
				this.waterDroplets.splice(index, 1);
			}
		}
	}

	private updateCamera(delta: number) {
		if (this.sewerIntroActive) {
			const focusProgress = this.reducedMotion
				? 1
				: THREE.MathUtils.clamp(this.sewerIntroTime / SEWER_INTRO_FOCUS_DURATION, 0, 1);
			const focusEase = 1 - Math.pow(1 - focusProgress, 5);
			this.cameraDesiredPosition.set(
				POOPIE_MONSTER_X - 2.08,
				SEWER_FLOOR_Y + 1.48,
				SEWER_CENTER_Z + 0.08
			);
			this.cameraDesiredTarget.set(
				POOPIE_MONSTER_X,
				SEWER_FLOOR_Y + POOPIE_MONSTER_HEIGHT * 0.69,
				SEWER_CENTER_Z
			);
			this.camera.position.lerpVectors(
				this.sewerIntroCameraPosition,
				this.cameraDesiredPosition,
				focusEase
			);
			this.cameraLookTarget.lerpVectors(
				this.sewerIntroCameraTarget,
				this.cameraDesiredTarget,
				focusEase
			);
			this.camera.fov = THREE.MathUtils.lerp(38, 24, focusEase);
			if (!this.reducedMotion && this.sewerIntroTime > SEWER_INTRO_AUDIO_DELAY) {
				const intensity = Math.min(1, (this.sewerIntroTime - SEWER_INTRO_AUDIO_DELAY) * 3);
				this.camera.position.x += Math.sin(this.sewerIntroTime * 31) * 0.012 * intensity;
				this.camera.position.y += Math.sin(this.sewerIntroTime * 24) * 0.009 * intensity;
			}
			this.camera.updateProjectionMatrix();
			this.camera.lookAt(this.cameraLookTarget);
			return;
		}

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
		const restoredFov = THREE.MathUtils.lerp(this.camera.fov, 46, 1 - Math.exp(-5.4 * delta));
		if (Math.abs(restoredFov - this.camera.fov) > 0.001) {
			this.camera.fov = restoredFov;
			this.camera.updateProjectionMatrix();
		}
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
		this.resetPoopieMonster();
		this.g36Unlocked = false;
		this.g36PickupAvailable = false;
		this.g36PickupTime = 0;
		this.g36Pickup.visible = false;
		this.rabbitInPoolWater = false;
		this.poolSplashCooldown = 0;
		this.poolWaveEnergy = 0;
		this.toiletFloorPlug.visible = true;
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
		this.syncGroundRoomVisibility();
		this.syncUpstairsVisibility();
	}

	private clearDebris() {
		for (const piece of this.debris) {
			piece.mesh.removeFromParent();
			piece.mesh.geometry.dispose();
			piece.mesh.material.dispose();
		}
		this.debris = [];
		for (const pile of this.garbagePiles) {
			pile.mesh.removeFromParent();
			pile.mesh.geometry.dispose();
			pile.mesh.material.dispose();
		}
		this.garbagePiles = [];
		for (const ring of this.impactRings) {
			this.scene.remove(ring.mesh);
			ring.mesh.geometry.dispose();
			ring.mesh.material.dispose();
		}
		this.impactRings = [];
	}

	private clearWaterEffects() {
		for (const ripple of this.waterRipples) {
			this.scene.remove(ripple.mesh);
			ripple.mesh.geometry.dispose();
			ripple.mesh.material.dispose();
		}
		this.waterRipples = [];
		for (const droplet of this.waterDroplets) {
			this.scene.remove(droplet.mesh);
			droplet.mesh.geometry.dispose();
			droplet.mesh.material.dispose();
		}
		this.waterDroplets = [];
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
		for (const effect of this.muzzleLightEffects) effect.light.intensity = 0;
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

	private standRabbitUpright() {
		if (this.stomping && this.stampTargetKind === 'wall') this.cancelStamp();
		this.rabbitTumble.quaternion.copy(this.uprightPose);
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

	private startSewerIntro() {
		if (this.sewerIntroPlayed || this.poopieMonsterState !== 'neutral') return;
		this.sewerIntroActive = true;
		this.sewerIntroPlayed = true;
		this.sewerIntroAudioPlayed = false;
		this.sewerIntroTime = 0;
		this.poopieMonsterSpeechArmed = false;
		this.weaponHeld = false;
		this.pointerActive = false;
		this.cancelStamp();
		this.velocity.set(0, 0, 0);
		this.standRabbitUpright();

		this.sewerIntroCameraPosition.set(
			POOPIE_MONSTER_X - 3.45,
			SEWER_FLOOR_Y + 1.64,
			SEWER_CENTER_Z + 0.52
		);
		this.sewerIntroCameraTarget.set(
			POOPIE_MONSTER_X,
			SEWER_FLOOR_Y + POOPIE_MONSTER_HEIGHT * 0.68,
			SEWER_CENTER_Z
		);
		this.camera.position.copy(this.sewerIntroCameraPosition);
		this.cameraLookTarget.copy(this.sewerIntroCameraTarget);
		this.camera.fov = 38;
		this.camera.updateProjectionMatrix();
		this.events.emit('sewerIntro', { active: true });
	}

	private updateSewerIntro(delta: number) {
		this.sewerIntroTime = Math.min(SEWER_INTRO_DURATION, this.sewerIntroTime + delta);
		this.velocity.set(0, 0, 0);
		this.weaponHeld = false;

		if (!this.sewerIntroAudioPlayed && this.sewerIntroTime >= SEWER_INTRO_AUDIO_DELAY) {
			this.sewerIntroAudioPlayed = true;
			this.audio.playPoopieMonsterSpeech();
		}

		if (this.sewerIntroTime < SEWER_INTRO_DURATION) return;
		this.sewerIntroActive = false;
		this.sewerIntroTime = 0;
		this.velocity.set(0, 6.2, 0);
		this.joltArms(0.75);
		this.events.emit('sewerIntro', { active: false });
	}

	private updatePoopieMonsterSpeech() {
		if (this.sewerIntroActive) return;
		if (!this.playerInSewer || this.poopieMonsterState !== 'neutral') {
			if (!this.playerInSewer) this.poopieMonsterSpeechArmed = true;
			return;
		}

		const distance = Math.abs(this.player.position.x - POOPIE_MONSTER_X);
		if (distance >= POOPIE_MONSTER_SPEECH_REARM_RADIUS) {
			this.poopieMonsterSpeechArmed = true;
		}
		if (this.muted || !this.poopieMonsterSpeechArmed || distance > POOPIE_MONSTER_SPEECH_RADIUS) {
			return;
		}

		this.poopieMonsterSpeechArmed = false;
		this.audio.playPoopieMonsterSpeech();
	}

	private playStampImpactSample(power: number) {
		if (this.lastStampImpactSoundSequence === this.stampSequence) return;
		this.lastStampImpactSoundSequence = this.stampSequence;
		this.audio.playImpact(power);
	}

	private emitFeedback(message: string) {
		this.events.emit('feedback', { message });
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
		this.events.emit('hud', state);
	}
}
