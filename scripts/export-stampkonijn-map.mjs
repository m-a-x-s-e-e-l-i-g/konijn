import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter uses FileReader in browsers. This small adapter keeps the exact
// same exporter usable from Node for the one-time code-to-asset migration.
if (!globalThis.FileReader) {
	globalThis.FileReader = class {
		result = null;
		onloadend = null;
		onerror = null;

		readAsArrayBuffer(blob) {
			blob
				.arrayBuffer()
				.then((result) => {
					this.result = result;
					this.onloadend?.({ target: this });
				})
				.catch((error) => this.onerror?.(error));
		}

		readAsDataURL(blob) {
			blob
				.arrayBuffer()
				.then((result) => {
					this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
					this.onloadend?.({ target: this });
				})
				.catch((error) => this.onerror?.(error));
		}
	};
}

const ROOM_WIDTH = 14;
const ROOM_DEPTH = 10;
const ROOM_HEIGHT = 4.8;
const BACK_WALL_Z = -ROOM_DEPTH / 2;
const WINDOW_CENTER_X = -4.7;
const WINDOW_CENTER_Y = 2.9;
const WINDOW_WIDTH = 2.8;
const WINDOW_HEIGHT = 2.1;
const KITCHEN_WIDTH = 7;
const KITCHEN_MIN_X = ROOM_WIDTH / 2;
const KITCHEN_MAX_X = KITCHEN_MIN_X + KITCHEN_WIDTH;
const KITCHEN_CENTER_X = (KITCHEN_MIN_X + KITCHEN_MAX_X) / 2;
const DOOR_CENTER_Z = 1.15;
const DOOR_WIDTH = 2.25;
const DOOR_HEIGHT = 2.85;
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
const TOILET_HOLE_RADIUS = 0.78;
const TOILET_HOLE_VISUAL_RADIUS = TOILET_HOLE_RADIUS + 0.14;
const TOILET_HOLE_EDGE_PROFILE = [
	1.03, 0.91, 1.08, 0.94, 1.01, 0.89, 1.06, 0.95, 1.02, 0.9, 1.07, 0.93, 1.01, 0.88, 1.05, 0.94
];
const KITCHEN_HATCH_X = 12.65;
const KITCHEN_HATCH_Z = 3.35;
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
const STAIR_STEP_COUNT = 12;
const STAIR_STEP_RISE = ROOM_HEIGHT / STAIR_STEP_COUNT;
const STAIR_STEP_RUN = 0.45;
const STAIR_BOTTOM_X = -7.46;
const STAIR_TOP_X = STAIR_BOTTOM_X - (STAIR_STEP_COUNT - 1) * STAIR_STEP_RUN;
const STAIR_TOP_Z = 0;
const UPSTAIRS_FLOOR_Y = ROOM_HEIGHT;
const UPSTAIRS_MIN_X = LEFT_ROOMS_MIN_X;
const UPSTAIRS_MAX_X = KITCHEN_MAX_X;
const UPSTAIRS_CENTER_X = (UPSTAIRS_MIN_X + UPSTAIRS_MAX_X) / 2;
const UPSTAIRS_STAIRWELL_MIN_X = UPSTAIRS_MIN_X + 0.1;
const UPSTAIRS_STAIRWELL_MAX_X = UPSTAIRS_STAIRWELL_MIN_X + 4;
const UPSTAIRS_STAIRWELL_CENTER_X = (UPSTAIRS_STAIRWELL_MIN_X + UPSTAIRS_STAIRWELL_MAX_X) / 2;
const UPSTAIRS_STAIRWELL_HALF_Z = 1.5;
const GARDEN_WIDTH = 28;
const GARDEN_DEPTH = 18;
const GARDEN_BACK_Z = BACK_WALL_Z - GARDEN_DEPTH;
const DOGHOUSE_X = 9;
const DOGHOUSE_Z = GARDEN_BACK_Z + 1.45;

const COLORS = {
	wall: 0xd7decf,
	wallWarm: 0xeadfcf,
	floor: 0xb7815d,
	rug: 0xe15b3d,
	ink: 0x251f1b,
	cream: 0xf6eddc
};

const root = new THREE.Group();
root.name = 'stampkonijn_house';
const zones = [];
const colliders = [];
const usedNames = new Set([root.name]);
const materials = new Map();

function uniqueName(name) {
	if (usedNames.has(name)) throw new Error(`Duplicate exported node name: ${name}`);
	usedNames.add(name);
	return name;
}

function makeMaterial(color, roughness = 0.82, metalness = 0.02) {
	const key = `${color}-${roughness}-${metalness}`;
	let result = materials.get(key);
	if (!result) {
		result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
		result.name = `material_${key}`;
		materials.set(key, result);
	}
	return result;
}

function zone(id, biome, enabledBy) {
	const group = new THREE.Group();
	group.name = uniqueName(`zone_${id}`);
	group.userData = { zone_id: id, biome, ...(enabledBy ? { enabled_by: enabledBy } : {}) };
	root.add(group);
	zones.push({
		id,
		node: group.name,
		biome,
		...(enabledBy ? { enabledBy } : {})
	});
	return group;
}

function mesh(name, geometry, color, position, options = {}) {
	const result = new THREE.Mesh(
		geometry,
		makeMaterial(color, options.roughness ?? 0.82, options.metalness ?? 0.02)
	);
	result.name = uniqueName(name);
	result.position.set(...position);
	if (options.rotation) result.rotation.set(...options.rotation);
	if (options.scale) result.scale.set(...options.scale);
	return result;
}

function box(name, size, position, color, options = {}) {
	return mesh(name, new THREE.BoxGeometry(...size), color, position, options);
}

function cylinder(name, radii, height, position, color, options = {}) {
	return mesh(
		name,
		new THREE.CylinderGeometry(radii[0], radii[1], height, options.segments ?? 20),
		color,
		position,
		options
	);
}

function addStatic(parent, object) {
	parent.add(object);
	return object;
}

function addCollider(parent, object, stampSurface, impactMaterial = 'concrete') {
	object.userData = {
		...object.userData,
		collider_shape: 'mesh',
		collider_id: object.name,
		stamp_surface: stampSurface,
		impact_material: impactMaterial
	};
	parent.add(object);
	colliders.push({
		id: object.name,
		node: object.name,
		zone: parent.userData.zone_id,
		shape: 'mesh'
	});
	return object;
}

function addLivingRoom(living) {
	addCollider(
		living,
		mesh('living_floor', new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), COLORS.floor, [0, 0, 0], {
			rotation: [-Math.PI / 2, 0, 0]
		}),
		'floor',
		'wood'
	);
	addStatic(
		living,
		mesh('living_rug', new THREE.CircleGeometry(2.8, 64), COLORS.rug, [0, 0.018, 1.1], {
			rotation: [-Math.PI / 2, 0, 0],
			scale: [1, 1, 0.62],
			roughness: 0.95
		})
	);

	const windowLeft = WINDOW_CENTER_X - WINDOW_WIDTH / 2;
	const windowRight = WINDOW_CENTER_X + WINDOW_WIDTH / 2;
	const windowBottom = WINDOW_CENTER_Y - WINDOW_HEIGHT / 2;
	const windowTop = WINDOW_CENTER_Y + WINDOW_HEIGHT / 2;
	for (const [name, size, position] of [
		[
			'living_back_wall_left',
			[windowLeft + ROOM_WIDTH / 2, ROOM_HEIGHT, 0.18],
			[(-ROOM_WIDTH / 2 + windowLeft) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z]
		],
		[
			'living_back_wall_right',
			[ROOM_WIDTH / 2 - windowRight, ROOM_HEIGHT, 0.18],
			[(windowRight + ROOM_WIDTH / 2) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z]
		],
		[
			'living_back_wall_below_window',
			[WINDOW_WIDTH, windowBottom, 0.18],
			[WINDOW_CENTER_X, windowBottom / 2, BACK_WALL_Z]
		],
		[
			'living_back_wall_above_window',
			[WINDOW_WIDTH, ROOM_HEIGHT - windowTop, 0.18],
			[WINDOW_CENTER_X, (windowTop + ROOM_HEIGHT) / 2, BACK_WALL_Z]
		]
	]) {
		addCollider(living, box(name, size, position, COLORS.wallWarm), 'wall');
	}

	let seamIndex = 0;
	for (let x = -5.6; x <= 5.6; x += 1.4) {
		addStatic(
			living,
			box(
				`living_floor_seam_${seamIndex++}`,
				[0.025, 0.008, ROOM_DEPTH - 0.3],
				[x, 0.024, 0],
				0x8e6048
			)
		);
	}

	for (const [name, size, offset] of [
		['window_frame_top', [WINDOW_WIDTH, 0.14, 0.2], [0, WINDOW_HEIGHT / 2, 0]],
		['window_frame_bottom', [WINDOW_WIDTH, 0.14, 0.2], [0, -WINDOW_HEIGHT / 2, 0]],
		['window_frame_left', [0.14, WINDOW_HEIGHT, 0.2], [-WINDOW_WIDTH / 2, 0, 0]],
		['window_frame_right', [0.14, WINDOW_HEIGHT, 0.2], [WINDOW_WIDTH / 2, 0, 0]]
	]) {
		addStatic(
			living,
			box(
				name,
				size,
				[WINDOW_CENTER_X + offset[0], WINDOW_CENTER_Y + offset[1], BACK_WALL_Z + 0.18 + offset[2]],
				COLORS.ink
			)
		);
	}
	addStatic(
		living,
		box('living_skirting', [ROOM_WIDTH - 0.2, 0.22, 0.16], [0, 0.11, -4.84], COLORS.cream)
	);

	addSharedDoorWalls(living);
}

function addSharedDoorWalls(living) {
	const leftDoors = [BATHROOM_DOOR_Z, STAIRS_DOOR_Z, BEDROOM_DOOR_Z];
	let wallCursor = BACK_WALL_Z;
	for (let index = 0; index < leftDoors.length; index += 1) {
		const centerZ = leftDoors[index];
		const doorMinZ = centerZ - LEFT_ROOM_DOOR_WIDTH / 2;
		const panelDepth = doorMinZ - wallCursor;
		if (panelDepth > 0.01) {
			addCollider(
				living,
				box(
					`left_shared_wall_${index}`,
					[0.18, ROOM_HEIGHT, panelDepth],
					[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, wallCursor + panelDepth / 2],
					COLORS.wall
				),
				'wall'
			);
		}
		addCollider(
			living,
			box(
				`left_shared_header_${index}`,
				[0.18, ROOM_HEIGHT - LEFT_ROOM_DOOR_HEIGHT, LEFT_ROOM_DOOR_WIDTH],
				[
					-ROOM_WIDTH / 2,
					LEFT_ROOM_DOOR_HEIGHT + (ROOM_HEIGHT - LEFT_ROOM_DOOR_HEIGHT) / 2,
					centerZ
				],
				COLORS.wall
			),
			'wall'
		);
		wallCursor = centerZ + LEFT_ROOM_DOOR_WIDTH / 2;
	}
	const finalDepth = ROOM_DEPTH / 2 - wallCursor;
	addCollider(
		living,
		box(
			'left_shared_wall_final',
			[0.18, ROOM_HEIGHT, finalDepth],
			[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, wallCursor + finalDepth / 2],
			COLORS.wall
		),
		'wall'
	);

	const doorMinZ = DOOR_CENTER_Z - DOOR_WIDTH / 2;
	const doorMaxZ = DOOR_CENTER_Z + DOOR_WIDTH / 2;
	const backPanelDepth = doorMinZ + ROOM_DEPTH / 2;
	const frontPanelDepth = ROOM_DEPTH / 2 - doorMaxZ;
	for (const [name, size, position] of [
		[
			'kitchen_shared_wall_back',
			[0.18, ROOM_HEIGHT, backPanelDepth],
			[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2 + backPanelDepth / 2]
		],
		[
			'kitchen_shared_wall_front',
			[0.18, ROOM_HEIGHT, frontPanelDepth],
			[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, doorMaxZ + frontPanelDepth / 2]
		],
		[
			'kitchen_shared_header',
			[0.18, ROOM_HEIGHT - DOOR_HEIGHT, DOOR_WIDTH],
			[ROOM_WIDTH / 2, DOOR_HEIGHT + (ROOM_HEIGHT - DOOR_HEIGHT) / 2, DOOR_CENTER_Z]
		]
	]) {
		addCollider(living, box(name, size, position, COLORS.wall), 'wall');
	}
}

function makeBathroomFloorGeometry(width, depth, centerZ) {
	const floorShape = new THREE.Shape();
	floorShape.moveTo(-width / 2, -depth / 2);
	floorShape.lineTo(width / 2, -depth / 2);
	floorShape.lineTo(width / 2, depth / 2);
	floorShape.lineTo(-width / 2, depth / 2);
	floorShape.closePath();

	const hole = new THREE.Path();
	const holeCenterX = TOILET_X - LEFT_ROOMS_CENTER_X;
	// ShapeGeometry's local Y becomes negative world Z after rotating the floor flat.
	const holeCenterY = -(TOILET_Z - centerZ);
	for (let index = 0; index < TOILET_HOLE_EDGE_PROFILE.length; index += 1) {
		const angle = -(index / TOILET_HOLE_EDGE_PROFILE.length) * Math.PI * 2;
		const radius = TOILET_HOLE_VISUAL_RADIUS * TOILET_HOLE_EDGE_PROFILE[index];
		const x = holeCenterX + Math.cos(angle) * radius;
		const y = holeCenterY + Math.sin(angle) * radius;
		if (index === 0) hole.moveTo(x, y);
		else hole.lineTo(x, y);
	}
	hole.closePath();
	floorShape.holes.push(hole);
	return new THREE.ShapeGeometry(floorShape);
}

function addLeftRooms(houseShell, bathroom, stairs, bedroom) {
	for (const [parent, id, minZ, maxZ, color, impact] of [
		[bathroom, 'bathroom', BACK_WALL_Z, BATHROOM_MAX_Z, 0xb9d1cf, 'concrete'],
		[stairs, 'stairs', BATHROOM_MAX_Z, BEDROOM_MIN_Z, 0x9a704e, 'wood'],
		[bedroom, 'bedroom', BEDROOM_MIN_Z, ROOM_DEPTH / 2, 0xc49087, 'wood']
	]) {
		const depth = maxZ - minZ;
		const centerZ = (minZ + maxZ) / 2;
		addCollider(
			parent,
			mesh(
				`${id}_floor`,
				id === 'bathroom'
					? makeBathroomFloorGeometry(LEFT_ROOMS_WIDTH, depth, centerZ)
					: new THREE.PlaneGeometry(LEFT_ROOMS_WIDTH, depth),
				color,
				[LEFT_ROOMS_CENTER_X, -0.003, centerZ],
				{ rotation: [-Math.PI / 2, 0, 0], roughness: 0.94 }
			),
			'floor',
			impact
		);
		addCollider(
			houseShell,
			box(
				`${id}_outer_wall`,
				[0.18, ROOM_HEIGHT, depth],
				[LEFT_ROOMS_MIN_X, ROOM_HEIGHT / 2, (minZ + maxZ) / 2],
				id === 'bedroom' ? 0xe2d0c1 : 0xd8c7b4
			),
			'wall'
		);
	}

	addCollider(
		houseShell,
		box(
			'bathroom_back_wall',
			[LEFT_ROOMS_WIDTH, ROOM_HEIGHT, 0.18],
			[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT / 2, BACK_WALL_Z],
			0xd7e2df
		),
		'wall'
	);
	addCollider(
		bathroom,
		box(
			'bathroom_divider',
			[LEFT_ROOMS_WIDTH, ROOM_HEIGHT, 0.18],
			[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT / 2, BATHROOM_MAX_Z],
			0xd7e2df
		),
		'wall'
	);
	addCollider(
		bedroom,
		box(
			'bedroom_divider',
			[LEFT_ROOMS_WIDTH, ROOM_HEIGHT, 0.18],
			[LEFT_ROOMS_CENTER_X, ROOM_HEIGHT / 2, BEDROOM_MIN_Z],
			0xe2d0c1
		),
		'wall'
	);

	let seamIndex = 0;
	for (let x = LEFT_ROOMS_MIN_X + 0.55; x < LEFT_ROOMS_MAX_X; x += 0.55) {
		if (Math.abs(x - TOILET_X) < TOILET_HOLE_VISUAL_RADIUS + 0.08) continue;
		addStatic(
			bathroom,
			box(
				`bathroom_seam_x_${seamIndex++}`,
				[0.016, 0.008, BATHROOM_MAX_Z - BACK_WALL_Z - 0.12],
				[x, 0.018, (BACK_WALL_Z + BATHROOM_MAX_Z) / 2],
				0x8ba9a7
			)
		);
	}
	seamIndex = 0;
	for (let z = BACK_WALL_Z + 0.55; z < BATHROOM_MAX_Z; z += 0.55) {
		if (Math.abs(z - TOILET_Z) < TOILET_HOLE_VISUAL_RADIUS + 0.08) continue;
		addStatic(
			bathroom,
			box(
				`bathroom_seam_z_${seamIndex++}`,
				[LEFT_ROOMS_WIDTH - 0.12, 0.008, 0.016],
				[LEFT_ROOMS_CENTER_X, 0.019, z],
				0x8ba9a7
			)
		);
	}

	const handBasinX = -8.75;
	const handBasinZ = BACK_WALL_Z + 0.43;
	addStatic(
		bathroom,
		box(
			'bathroom_basin_support',
			[0.68, 0.58, 0.38],
			[handBasinX, 0.34, handBasinZ - 0.08],
			0x6b8e88
		)
	);
	addStatic(
		bathroom,
		mesh(
			'bathroom_basin',
			new THREE.SphereGeometry(0.34, 18, 10),
			0xe6e2d8,
			[handBasinX, 0.72, handBasinZ],
			{ scale: [1.08, 0.32, 0.7], roughness: 0.42 }
		)
	);
	addStatic(
		bathroom,
		cylinder('bathroom_drain', [0.055, 0.055], 0.48, [handBasinX, 0.25, handBasinZ], 0x777a78)
	);
	addStatic(
		bathroom,
		cylinder(
			'bathroom_tap_stem',
			[0.035, 0.035],
			0.24,
			[handBasinX, 0.98, handBasinZ - 0.1],
			0x777a78,
			{ segments: 10 }
		)
	);
	addStatic(
		bathroom,
		cylinder('bathroom_tap_spout', [0.032, 0.032], 0.2, [handBasinX, 1.08, handBasinZ], 0x777a78, {
			segments: 10,
			rotation: [Math.PI / 2, 0, 0]
		})
	);
	addStatic(
		bathroom,
		box('bathroom_tap_handle', [0.2, 0.035, 0.055], [handBasinX, 1.12, handBasinZ - 0.1], 0x777a78)
	);
	addStatic(
		bathroom,
		box('bathroom_mirror', [0.74, 0.82, 0.035], [handBasinX, 1.7, BACK_WALL_Z + 0.12], 0x88b4bd)
	);

	const stairWidth = 2.28;
	const railPoints = [];
	for (let index = 0; index < STAIR_STEP_COUNT; index += 1) {
		const x = STAIR_BOTTOM_X - index * STAIR_STEP_RUN;
		const topY = STAIR_STEP_RISE * (index + 1);
		const tread = box(
			`stairs_tread_${index}`,
			[STAIR_STEP_RUN + 0.08, 0.1, stairWidth],
			[x, topY - 0.05, STAIR_TOP_Z],
			index % 2 === 0 ? 0x9a6b46 : 0xa87950
		);
		const riser = box(
			`stairs_riser_${index}`,
			[0.1, STAIR_STEP_RISE - 0.1, stairWidth - 0.06],
			[x - (STAIR_STEP_RUN + 0.08) / 2 + 0.05, topY - (STAIR_STEP_RISE + 0.1) / 2, STAIR_TOP_Z],
			0x68462f
		);
		addCollider(stairs, tread, 'floor', 'wood');
		addCollider(stairs, riser, 'wall', 'wood');
		if (index % 2 === 0) {
			const railX = x;
			const railZ = STAIR_TOP_Z - (stairWidth / 2 + 0.04);
			addStatic(
				stairs,
				cylinder(
					`stairs_rail_post_${index}`,
					[0.038, 0.046],
					0.84,
					[railX, topY + 0.42, railZ],
					0x3d3029,
					{
						segments: 8
					}
				)
			);
			railPoints.push(new THREE.Vector3(railX, topY + 0.84, railZ));
		}
	}
	const finalRail = new THREE.Vector3(
		STAIR_BOTTOM_X - (STAIR_STEP_COUNT - 1) * STAIR_STEP_RUN,
		STAIR_STEP_RISE * STAIR_STEP_COUNT + 0.84,
		STAIR_TOP_Z - (stairWidth / 2 + 0.04)
	);
	if (!railPoints.at(-1).equals(finalRail)) railPoints.push(finalRail);
	for (let index = 1; index < railPoints.length; index += 1) {
		const start = railPoints[index - 1];
		const end = railPoints[index];
		const direction = end.clone().sub(start);
		const rail = cylinder(
			`stairs_handrail_${index}`,
			[0.05, 0.05],
			direction.length(),
			[(start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2],
			0x3d3029,
			{ segments: 10 }
		);
		rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
		addStatic(stairs, rail);
	}

	addStatic(
		bedroom,
		box('bedroom_wardrobe', [0.82, 2.2, 1.35], [LEFT_ROOMS_MIN_X + 0.52, 1.1, 3.25], 0x7d5a46)
	);
	addStatic(
		bedroom,
		mesh('bedroom_rug', new THREE.CircleGeometry(1.2, 32), 0x725c72, [-9.15, 0.015, 3.5], {
			rotation: [-Math.PI / 2, 0, 0],
			scale: [1, 1, 0.64],
			roughness: 0.95
		})
	);
}

function addKitchen(houseShell, kitchen) {
	addCollider(
		kitchen,
		mesh(
			'kitchen_floor',
			new THREE.PlaneGeometry(KITCHEN_WIDTH, ROOM_DEPTH),
			0xd5c7ae,
			[KITCHEN_CENTER_X, -0.004, 0],
			{ rotation: [-Math.PI / 2, 0, 0], roughness: 0.94 }
		),
		'floor'
	);
	let seamIndex = 0;
	for (let x = KITCHEN_MIN_X + 0.7; x < KITCHEN_MAX_X; x += 0.7) {
		addStatic(
			kitchen,
			box(
				`kitchen_seam_x_${seamIndex++}`,
				[0.018, 0.008, ROOM_DEPTH - 0.2],
				[x, 0.018, 0],
				0xb7a68b
			)
		);
	}
	seamIndex = 0;
	for (let z = BACK_WALL_Z + 0.7; z < ROOM_DEPTH / 2; z += 0.7) {
		addStatic(
			kitchen,
			box(
				`kitchen_seam_z_${seamIndex++}`,
				[KITCHEN_WIDTH - 0.2, 0.008, 0.018],
				[KITCHEN_CENTER_X, 0.019, z],
				0xb7a68b
			)
		);
	}

	addCollider(
		houseShell,
		box(
			'kitchen_outer_wall',
			[0.18, ROOM_HEIGHT, ROOM_DEPTH],
			[KITCHEN_MAX_X, ROOM_HEIGHT / 2, 0],
			0xe0cbb1
		),
		'wall'
	);
	const backDoorLeft = KITCHEN_BACK_DOOR_X - KITCHEN_BACK_DOOR_WIDTH / 2;
	const backDoorRight = KITCHEN_BACK_DOOR_X + KITCHEN_BACK_DOOR_WIDTH / 2;
	for (const [name, size, position] of [
		[
			'kitchen_back_wall_left',
			[backDoorLeft - KITCHEN_MIN_X, ROOM_HEIGHT, 0.18],
			[(KITCHEN_MIN_X + backDoorLeft) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z]
		],
		[
			'kitchen_back_wall_right',
			[KITCHEN_MAX_X - backDoorRight, ROOM_HEIGHT, 0.18],
			[(backDoorRight + KITCHEN_MAX_X) / 2, ROOM_HEIGHT / 2, BACK_WALL_Z]
		],
		[
			'kitchen_back_wall_header',
			[KITCHEN_BACK_DOOR_WIDTH, ROOM_HEIGHT - KITCHEN_BACK_DOOR_HEIGHT, 0.18],
			[
				KITCHEN_BACK_DOOR_X,
				KITCHEN_BACK_DOOR_HEIGHT + (ROOM_HEIGHT - KITCHEN_BACK_DOOR_HEIGHT) / 2,
				BACK_WALL_Z
			]
		]
	]) {
		addCollider(houseShell, box(name, size, position, 0xe7d6bd), 'wall');
	}

	for (const [index, x] of [8.15, 9.45, 10.75].entries()) {
		addStatic(
			kitchen,
			box(
				`kitchen_lower_cabinet_${index}`,
				[1.18, 0.86, 0.68],
				[x, 0.43, BACK_WALL_Z + 0.43],
				0x78966f
			)
		);
		addStatic(
			kitchen,
			box(
				`kitchen_upper_cabinet_${index}`,
				[1.18, 0.86, 0.48],
				[x, 2.45, BACK_WALL_Z + 0.34],
				0x91aa86
			)
		);
	}
	addStatic(
		kitchen,
		box('kitchen_counter', [4.05, 0.14, 0.84], [9.45, 0.93, BACK_WALL_Z + 0.48], 0x4a403a)
	);
	addStatic(
		kitchen,
		box('kitchen_sink', [0.78, 0.045, 0.46], [9.45, 1.015, BACK_WALL_Z + 0.51], 0xa9aaa3)
	);
	addStatic(
		kitchen,
		cylinder('kitchen_tap', [0.035, 0.035], 0.5, [9.45, 1.23, BACK_WALL_Z + 0.25], 0x6f7373, {
			segments: 10,
			rotation: [Math.PI / 2, 0, 0]
		})
	);
}

function addUpstairs(houseShell, upstairs) {
	const upstairsWidth = UPSTAIRS_MAX_X - UPSTAIRS_MIN_X;
	const stairwellWidth = UPSTAIRS_STAIRWELL_MAX_X - UPSTAIRS_STAIRWELL_MIN_X;
	const stairwellSideDepth = ROOM_DEPTH / 2 - UPSTAIRS_STAIRWELL_HALF_Z;
	for (const [index, [width, depth, x, z]] of [
		[
			UPSTAIRS_MAX_X - UPSTAIRS_STAIRWELL_MAX_X,
			ROOM_DEPTH,
			(UPSTAIRS_MAX_X + UPSTAIRS_STAIRWELL_MAX_X) / 2,
			0
		],
		[
			stairwellWidth,
			stairwellSideDepth,
			UPSTAIRS_STAIRWELL_CENTER_X,
			BACK_WALL_Z + stairwellSideDepth / 2
		],
		[
			stairwellWidth,
			stairwellSideDepth,
			UPSTAIRS_STAIRWELL_CENTER_X,
			ROOM_DEPTH / 2 - stairwellSideDepth / 2
		]
	].entries()) {
		addCollider(
			upstairs,
			box(
				`upstairs_floor_${index}`,
				[width, 0.08, depth],
				[x, UPSTAIRS_FLOOR_Y - 0.02, z],
				0x30342f,
				{
					roughness: 0.9
				}
			),
			'floor',
			'metal'
		);
	}

	let seamIndex = 0;
	for (let x = UPSTAIRS_MIN_X + 0.9; x < UPSTAIRS_MAX_X; x += 0.9) {
		if (x < UPSTAIRS_STAIRWELL_MAX_X) continue;
		addStatic(
			upstairs,
			box(
				`upstairs_floor_seam_${seamIndex++}`,
				[0.025, 0.012, ROOM_DEPTH - 0.24],
				[x, UPSTAIRS_FLOOR_Y + 0.026, 0],
				0x20241f
			)
		);
	}
	for (const [name, size, position, color] of [
		[
			'upstairs_left_wall',
			[0.2, ROOM_HEIGHT, ROOM_DEPTH],
			[UPSTAIRS_MIN_X, UPSTAIRS_FLOOR_Y + ROOM_HEIGHT / 2, 0],
			0x454942
		],
		[
			'upstairs_right_wall',
			[0.2, ROOM_HEIGHT, ROOM_DEPTH],
			[UPSTAIRS_MAX_X, UPSTAIRS_FLOOR_Y + ROOM_HEIGHT / 2, 0],
			0x454942
		],
		[
			'upstairs_back_wall',
			[upstairsWidth, ROOM_HEIGHT, 0.2],
			[UPSTAIRS_CENTER_X, UPSTAIRS_FLOOR_Y + ROOM_HEIGHT / 2, BACK_WALL_Z],
			0x383d38
		]
	]) {
		addCollider(houseShell, box(name, size, position, color), 'wall');
	}
	for (const [sideIndex, z] of [-UPSTAIRS_STAIRWELL_HALF_Z, UPSTAIRS_STAIRWELL_HALF_Z].entries()) {
		addStatic(
			upstairs,
			box(
				`upstairs_railing_${sideIndex}`,
				[stairwellWidth, 0.09, 0.09],
				[UPSTAIRS_STAIRWELL_CENTER_X, UPSTAIRS_FLOOR_Y + 0.9, z],
				0x1c211e
			)
		);
		for (const [postIndex, x] of [
			UPSTAIRS_STAIRWELL_MIN_X + 0.12,
			UPSTAIRS_STAIRWELL_CENTER_X,
			UPSTAIRS_STAIRWELL_MAX_X - 0.12
		].entries()) {
			addStatic(
				upstairs,
				cylinder(
					`upstairs_rail_post_${sideIndex}_${postIndex}`,
					[0.04, 0.045],
					0.9,
					[x, UPSTAIRS_FLOOR_Y + 0.45, z],
					0x1c211e,
					{
						segments: 8
					}
				)
			);
		}
	}
	for (const [index, x] of [-8.6, 0.2, 9].entries()) {
		addStatic(
			upstairs,
			box(
				`upstairs_beam_${index}`,
				[0.08, 0.08, ROOM_DEPTH - 0.5],
				[x, UPSTAIRS_FLOOR_Y + 4.25, 0],
				0x171b18
			)
		);
	}
}

function addBasement(basement) {
	const basementWidth = BASEMENT_MAX_X - BASEMENT_MIN_X;
	addCollider(
		basement,
		mesh(
			'basement_floor',
			new THREE.PlaneGeometry(basementWidth, ROOM_DEPTH),
			0x63503b,
			[BASEMENT_CENTER_X, BASEMENT_FLOOR_Y, 0],
			{ rotation: [-Math.PI / 2, 0, 0], roughness: 1 }
		),
		'floor',
		'land'
	);
	const basementHeight = Math.abs(BASEMENT_FLOOR_Y) + 0.1;
	for (const [name, size, position, color] of [
		[
			'basement_left_wall',
			[0.22, basementHeight, ROOM_DEPTH],
			[BASEMENT_MIN_X, BASEMENT_FLOOR_Y + basementHeight / 2, 0],
			0x443a31
		],
		[
			'basement_right_wall',
			[0.22, basementHeight, ROOM_DEPTH],
			[BASEMENT_MAX_X, BASEMENT_FLOOR_Y + basementHeight / 2, 0],
			0x443a31
		],
		[
			'basement_back_wall',
			[basementWidth, basementHeight, 0.22],
			[BASEMENT_CENTER_X, BASEMENT_FLOOR_Y + basementHeight / 2, BACK_WALL_Z],
			0x3b332c
		]
	]) {
		addCollider(basement, box(name, size, position, color), 'wall', 'land');
	}

	for (let index = 0; index < BASEMENT_STAIR_STEP_COUNT; index += 1) {
		const x = BASEMENT_STAIR_BOTTOM_X + index * BASEMENT_STAIR_RUN;
		const topY = BASEMENT_FLOOR_Y + (index + 1) * BASEMENT_STAIR_RISE;
		addCollider(
			basement,
			box(
				`basement_stair_tread_${index}`,
				[BASEMENT_STAIR_RUN + 0.04, 0.11, BASEMENT_STAIR_WIDTH],
				[x, topY - 0.055, KITCHEN_HATCH_Z],
				index % 2 === 0 ? 0x8a5b36 : 0x765033
			),
			'floor',
			'wood'
		);
		addCollider(
			basement,
			box(
				`basement_stair_riser_${index}`,
				[0.09, BASEMENT_STAIR_RISE - 0.11, BASEMENT_STAIR_WIDTH - 0.08],
				[x - BASEMENT_STAIR_RUN / 2, topY - (BASEMENT_STAIR_RISE + 0.11) / 2, KITCHEN_HATCH_Z],
				0x4e3324
			),
			'wall',
			'wood'
		);
	}
	const stairRun = (BASEMENT_STAIR_STEP_COUNT - 1) * BASEMENT_STAIR_RUN;
	const stairRise = (BASEMENT_STAIR_STEP_COUNT - 1) * BASEMENT_STAIR_RISE;
	const stairLength = Math.hypot(stairRun, stairRise);
	const stairAngle = Math.atan2(stairRise, stairRun);
	const stairCenterX = (BASEMENT_STAIR_BOTTOM_X + KITCHEN_HATCH_X) / 2;
	const bottomStepY = BASEMENT_FLOOR_Y + BASEMENT_STAIR_RISE;
	const topStepY = BASEMENT_FLOOR_Y + BASEMENT_STAIR_STEP_COUNT * BASEMENT_STAIR_RISE;
	const stairCenterY = (bottomStepY + topStepY) / 2;
	for (const [index, zOffset] of [
		-BASEMENT_STAIR_WIDTH / 2 + 0.08,
		BASEMENT_STAIR_WIDTH / 2 - 0.08
	].entries()) {
		addStatic(
			basement,
			box(
				`basement_stair_stringer_${index}`,
				[stairLength, 0.14, 0.13],
				[stairCenterX, stairCenterY - 0.2, KITCHEN_HATCH_Z + zOffset],
				0x4e3324,
				{ rotation: [0, 0, stairAngle] }
			)
		);
	}
	const railZ = KITCHEN_HATCH_Z + BASEMENT_STAIR_WIDTH / 2 + 0.08;
	for (let index = 0; index < BASEMENT_STAIR_STEP_COUNT; index += 2) {
		const x = BASEMENT_STAIR_BOTTOM_X + index * BASEMENT_STAIR_RUN;
		const topY = BASEMENT_FLOOR_Y + (index + 1) * BASEMENT_STAIR_RISE;
		addStatic(
			basement,
			cylinder(
				`basement_stair_rail_post_${index}`,
				[0.035, 0.045],
				0.82,
				[x, topY + 0.41, railZ],
				0x4e3324,
				{ segments: 8 }
			)
		);
	}
	const handrailDirection = new THREE.Vector3(stairRun, stairRise, 0).normalize();
	const handrail = cylinder(
		'basement_stair_handrail',
		[0.05, 0.05],
		stairLength + 0.18,
		[stairCenterX, stairCenterY + 0.82, railZ],
		0x4e3324,
		{ segments: 10 }
	);
	handrail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), handrailDirection);
	addStatic(basement, handrail);

	for (let index = 0; index < 18; index += 1) {
		const x = BASEMENT_MIN_X + 0.7 + ((index * 3.17) % (basementWidth - 1.4));
		const z = BACK_WALL_Z + 0.55 + ((index * 2.41) % (ROOM_DEPTH - 1.1));
		addStatic(
			basement,
			mesh(
				`basement_sand_mound_${index}`,
				new THREE.SphereGeometry(0.65 + (index % 3) * 0.14, 12, 7),
				index % 2 === 0 ? 0x7a6042 : 0x6e563d,
				[x, BASEMENT_FLOOR_Y - 0.03, z],
				{ scale: [1.35 + (index % 4) * 0.18, 0.16 + (index % 3) * 0.035, 0.82], roughness: 1 }
			)
		);
	}
	for (let index = 0; index < 26; index += 1) {
		addStatic(
			basement,
			mesh(
				`basement_rock_${index}`,
				new THREE.DodecahedronGeometry(0.07 + (index % 4) * 0.025, 0),
				index % 3 === 0 ? 0x493d32 : 0x796249,
				[
					BASEMENT_MIN_X + 0.4 + ((index * 4.11) % (basementWidth - 0.8)),
					BASEMENT_FLOOR_Y + 0.05,
					BACK_WALL_Z + 0.35 + ((index * 3.07) % (ROOM_DEPTH - 0.7))
				],
				{ scale: [1, 0.55, 1], roughness: 1 }
			)
		);
	}
	for (const [index, x] of [-5.3, 1.9, 9.1].entries()) {
		addStatic(
			basement,
			box(
				`basement_column_${index}`,
				[0.46, 3.82, 0.46],
				[x, BASEMENT_FLOOR_Y + 1.91, -0.2],
				0x55564f
			)
		);
		addStatic(
			basement,
			box(`basement_beam_${index}`, [0.62, 0.34, ROOM_DEPTH - 0.35], [x, -0.2, 0], 0x4d4239)
		);
	}
	addStatic(
		basement,
		cylinder(
			'basement_boiler',
			[0.68, 0.72],
			2.25,
			[11.8, BASEMENT_FLOOR_Y + 1.13, -3.55],
			0x7e6654
		)
	);
	addStatic(
		basement,
		cylinder(
			'basement_boiler_pipe',
			[0.13, 0.13],
			1.55,
			[11.8, BASEMENT_FLOOR_Y + 2.95, -3.55],
			0x76503a,
			{ segments: 12 }
		)
	);
	for (const [name, size, position, color, rotation] of [
		[
			'basement_crate_large',
			[1.05, 0.92, 0.82],
			[-5.2, BASEMENT_FLOOR_Y + 0.46, -3.6],
			0x7a573d,
			0.16
		],
		[
			'basement_crate_small',
			[0.86, 0.7, 0.72],
			[-4.25, BASEMENT_FLOOR_Y + 0.35, -3.35],
			0x8b6548,
			-0.12
		],
		['basement_old_cabinet', [1.35, 1.72, 0.42], [7.8, BASEMENT_FLOOR_Y + 0.86, -4.45], 0x4e514b, 0]
	]) {
		addStatic(basement, box(name, size, position, color, { rotation: [0, rotation, 0] }));
	}
}

function addSewer(sewer) {
	const gateWidth = 3.4;
	const gateRight = SEWER_MIN_X + gateWidth;
	addCollider(
		sewer,
		mesh(
			'sewer_floor',
			new THREE.PlaneGeometry(SEWER_WIDTH, SEWER_DEPTH),
			0x303932,
			[SEWER_CENTER_X, SEWER_FLOOR_Y, SEWER_CENTER_Z],
			{ rotation: [-Math.PI / 2, 0, 0], roughness: 1 }
		),
		'floor',
		'concrete'
	);
	for (const [name, size, position, color] of [
		[
			'sewer_right_wall',
			[0.28, SEWER_HEIGHT, SEWER_DEPTH],
			[SEWER_MAX_X, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, SEWER_CENTER_Z],
			0x5a4b3b
		],
		[
			'sewer_back_wall_main',
			[SEWER_MAX_X - gateRight, SEWER_HEIGHT, 0.18],
			[(gateRight + SEWER_MAX_X) / 2, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, SEWER_MIN_Z],
			0x3a423b
		]
	]) {
		addCollider(sewer, box(name, size, position, color), 'wall');
	}

	const gateZ = SEWER_MIN_Z + 0.025;
	addStatic(
		sewer,
		box(
			'sewer_left_gate_darkness',
			[gateWidth - 0.08, SEWER_HEIGHT - 0.12, 0.12],
			[(SEWER_MIN_X + gateRight) / 2, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, SEWER_MIN_Z - 0.38],
			0x111913,
			{ roughness: 1 }
		)
	);
	for (const [index, x] of [SEWER_MIN_X, gateRight].entries()) {
		addStatic(
			sewer,
			box(
				`sewer_left_gate_post_${index}`,
				[0.2, SEWER_HEIGHT, 0.2],
				[x, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, gateZ],
				0x865d42,
				{ roughness: 0.58, metalness: 0.62 }
			)
		);
	}
	for (let index = 0; index < 8; index += 1) {
		const x = SEWER_MIN_X + 0.22 + (index * (gateWidth - 0.44)) / 7;
		addStatic(
			sewer,
			box(
				`sewer_left_gate_bar_${index}`,
				[0.085, SEWER_HEIGHT - 0.24, 0.09],
				[x, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, gateZ + 0.02],
				index % 3 === 0 ? 0x93694a : 0x725343,
				{ roughness: 0.5, metalness: 0.7 }
			)
		);
	}
	for (const [index, y] of [SEWER_FLOOR_Y + 0.42, SEWER_CEILING_Y - 0.48].entries()) {
		addStatic(
			sewer,
			box(
				`sewer_left_gate_rail_${index}`,
				[gateWidth, 0.13, 0.12],
				[(SEWER_MIN_X + gateRight) / 2, y, gateZ + 0.04],
				0x805c45,
				{ roughness: 0.55, metalness: 0.66 }
			)
		);
	}
	addStatic(
		sewer,
		box(
			'sewer_left_gate_brace',
			[Math.hypot(gateWidth - 0.5, SEWER_HEIGHT - 0.85), 0.11, 0.1],
			[(SEWER_MIN_X + gateRight) / 2, SEWER_FLOOR_Y + SEWER_HEIGHT / 2, gateZ + 0.07],
			0x896247,
			{
				roughness: 0.54,
				metalness: 0.64,
				rotation: [0, 0, Math.atan2(SEWER_HEIGHT - 0.85, gateWidth - 0.5)]
			}
		)
	);
	addStatic(
		sewer,
		box(
			'sewer_left_gate_lock',
			[0.34, 0.42, 0.16],
			[gateRight - 0.4, SEWER_FLOOR_Y + SEWER_HEIGHT * 0.52, gateZ + 0.13],
			0x8a6b43,
			{ roughness: 0.48, metalness: 0.72 }
		)
	);
	const shaftMinX = TOILET_X - SEWER_SHAFT_HALF_WIDTH;
	const shaftMaxX = TOILET_X + SEWER_SHAFT_HALF_WIDTH;
	for (const [index, [minX, maxX]] of [
		[SEWER_MIN_X, shaftMinX],
		[shaftMaxX, SEWER_MAX_X]
	].entries()) {
		addCollider(
			sewer,
			box(
				`sewer_roof_${index}`,
				[maxX - minX, 0.18, SEWER_DEPTH],
				[(minX + maxX) / 2, SEWER_CEILING_Y, SEWER_CENTER_Z],
				0x252d28
			),
			'wall'
		);
	}
	addStatic(
		sewer,
		box(
			'sewer_foreground_floor',
			[SEWER_WIDTH, 0.16, 8],
			[SEWER_CENTER_X, SEWER_FLOOR_Y - 0.02, SEWER_MAX_Z + 4],
			0x303932
		)
	);
	for (const [index, [minX, maxX]] of [
		[SEWER_MIN_X, shaftMinX],
		[shaftMaxX, SEWER_MAX_X]
	].entries()) {
		addStatic(
			sewer,
			box(
				`sewer_foreground_roof_${index}`,
				[maxX - minX, 0.16, 8],
				[(minX + maxX) / 2, SEWER_CEILING_Y + 0.02, SEWER_MAX_Z + 4],
				0x252d28
			)
		);
	}
	const shaftHeight = Math.abs(SEWER_CEILING_Y);
	for (const [index, x] of [shaftMinX - 0.08, shaftMaxX + 0.08].entries()) {
		addStatic(
			sewer,
			box(
				`sewer_shaft_wall_${index}`,
				[0.16, shaftHeight, SEWER_DEPTH - 0.18],
				[x, SEWER_CEILING_Y + shaftHeight / 2, SEWER_CENTER_Z],
				0x3f473f
			)
		);
	}
	for (const [index, y] of [SEWER_CEILING_Y + 0.28, -2.7, -1.3].entries()) {
		addStatic(
			sewer,
			mesh(
				`sewer_shaft_ring_${index}`,
				new THREE.TorusGeometry(SEWER_SHAFT_HALF_WIDTH + 0.12, 0.07, 8, 24),
				0x76533b,
				[TOILET_X, y, SEWER_CENTER_Z],
				{
					rotation: [Math.PI / 2, 0, 0],
					roughness: 0.86
				}
			)
		);
	}
	const sludgeShape = new THREE.Shape();
	const sludgeHalfWidth = SEWER_WIDTH / 2 - 0.3;
	const sludgeBackEdge = [-0.72, -0.82, -0.7, -0.88, -0.74, -0.8, -0.66, -0.76, -0.7];
	const sludgeFrontEdge = [0.84, 0.7, 0.92, 0.78, 0.96, 0.73, 0.88, 0.77, 0.9];
	for (let index = 0; index < sludgeBackEdge.length; index += 1) {
		const x = THREE.MathUtils.lerp(
			-sludgeHalfWidth,
			sludgeHalfWidth,
			index / (sludgeBackEdge.length - 1)
		);
		if (index === 0) sludgeShape.moveTo(x, sludgeBackEdge[index]);
		else sludgeShape.lineTo(x, sludgeBackEdge[index]);
	}
	for (let index = sludgeFrontEdge.length - 1; index >= 0; index -= 1) {
		const x = THREE.MathUtils.lerp(
			-sludgeHalfWidth,
			sludgeHalfWidth,
			index / (sludgeFrontEdge.length - 1)
		);
		sludgeShape.lineTo(x, sludgeFrontEdge[index]);
	}
	sludgeShape.closePath();
	const sludge = new THREE.Mesh(
		new THREE.ShapeGeometry(sludgeShape),
		new THREE.MeshPhysicalMaterial({
			color: 0x586437,
			roughness: 0.16,
			metalness: 0.04,
			clearcoat: 0.86,
			clearcoatRoughness: 0.14,
			emissive: 0x111609,
			emissiveIntensity: 0.28
		})
	);
	sludge.name = uniqueName('sewer_sludge');
	sludge.position.set(SEWER_CENTER_X, SEWER_FLOOR_Y + 0.032, SEWER_CENTER_Z + 0.05);
	sludge.rotation.x = -Math.PI / 2;
	addStatic(sewer, sludge);
	for (const [index, [x, z, radiusX, radiusZ]] of [
		[SEWER_MIN_X + 1.1, SEWER_CENTER_Z + 0.58, 0.72, 0.46],
		[TOILET_X + 6.8, SEWER_CENTER_Z - 0.67, 1.15, 0.4],
		[TOILET_X + 19.4, SEWER_CENTER_Z + 0.72, 0.92, 0.36],
		[TOILET_X + 33.2, SEWER_CENTER_Z - 0.7, 1.28, 0.42],
		[SEWER_MAX_X - 4.1, SEWER_CENTER_Z + 0.68, 1.05, 0.4]
	].entries()) {
		const puddle = new THREE.Mesh(
			new THREE.CircleGeometry(1, 24),
			new THREE.MeshPhysicalMaterial({
				color: index % 2 === 0 ? 0x687444 : 0x59663a,
				roughness: 0.22,
				metalness: 0.03,
				clearcoat: 0.68,
				clearcoatRoughness: 0.2,
				emissive: 0x101509,
				emissiveIntensity: 0.2
			})
		);
		puddle.name = uniqueName(`sewer_sludge_puddle_${index}`);
		puddle.position.set(x, SEWER_FLOOR_Y + 0.038 + index * 0.0005, z);
		puddle.rotation.x = -Math.PI / 2;
		puddle.scale.set(radiusX, radiusZ, 1);
		addStatic(sewer, puddle);
	}
	let pipeIndex = 0;
	for (let x = SEWER_MIN_X + 2; x < SEWER_MAX_X; x += 5.2) {
		addStatic(
			sewer,
			cylinder(
				`sewer_pipe_${pipeIndex++}`,
				[0.16, 0.16],
				SEWER_DEPTH - 0.24,
				[x, SEWER_FLOOR_Y + 3.3, SEWER_CENTER_Z - 0.18],
				0x835b3c,
				{
					segments: 14,
					rotation: [Math.PI / 2, 0, 0]
				}
			)
		);
	}
	for (let index = 0; index < 16; index += 1) {
		if (index === 0) continue;
		const x = TOILET_X + 6.5 + index * 4.55;
		if (x > SEWER_MAX_X - 5) break;
		const fromFloor = index % 2 === 0 || index % 5 === 3;
		const height = fromFloor ? 1.05 + (index % 3) * 0.18 : 1.12 + (index % 4) * 0.13;
		const centerY = fromFloor ? height / 2 : SEWER_HEIGHT - height / 2;
		addCollider(
			sewer,
			box(
				`sewer_obstacle_${index}`,
				[0.95 + (index % 3) * 0.17, height, SEWER_DEPTH - 0.28],
				[x, SEWER_FLOOR_Y + centerY, SEWER_CENTER_Z],
				0x59605a
			),
			'wall'
		);
	}
	for (let index = 0; index < 4; index += 1) {
		addStatic(
			sewer,
			box(
				`sewer_foundation_${index}`,
				[0.42, 0.48, SEWER_DEPTH - 0.24],
				[SEWER_MAX_X - 0.25, SEWER_FLOOR_Y + 0.3 + index * 0.76, SEWER_CENTER_Z],
				index % 2 === 0 ? 0x8d755d : 0x6f5b49,
				{
					rotation: [0, 0, index % 2 === 0 ? 0.035 : -0.025]
				}
			)
		);
	}
}

function addNeighborHouse(parent, index, position, wallColor, roofColor, rotationY = 0) {
	const house = new THREE.Group();
	house.name = uniqueName(`suburb_house_${index}`);
	house.position.set(...position);
	house.rotation.y = rotationY;
	const width = 4.8 + (index % 2) * 0.65;
	const depth = 5.2 + (index % 3) * 0.48;
	const wallHeight = 3.25 + (index % 2) * 0.3;
	house.add(
		box(
			`suburb_house_${index}_body`,
			[width, wallHeight, depth],
			[0, wallHeight / 2, 0],
			wallColor,
			{
				roughness: 0.96
			}
		),
		box(
			`suburb_house_${index}_roof_left`,
			[width * 0.61, 0.22, depth + 0.4],
			[-width * 0.235, wallHeight + 0.48, 0],
			roofColor,
			{ rotation: [0, 0, 0.55], roughness: 0.92 }
		),
		box(
			`suburb_house_${index}_roof_right`,
			[width * 0.61, 0.22, depth + 0.4],
			[width * 0.235, wallHeight + 0.48, 0],
			roofColor,
			{ rotation: [0, 0, -0.55], roughness: 0.92 }
		),
		box(
			`suburb_house_${index}_door`,
			[0.88, 1.72, 0.08],
			[width * 0.2, 0.86, -depth / 2 - 0.045],
			index % 2 ? 0x506c78 : 0x94543f
		)
	);

	for (const [windowIndex, x] of [-width * 0.25, width * 0.24].entries()) {
		house.add(
			box(
				`suburb_house_${index}_window_${windowIndex}`,
				[1.05, 0.86, 0.06],
				[x, 2.12, -depth / 2 - 0.055],
				windowIndex === 0 ? 0xaed0d7 : 0xe7c783,
				{ roughness: 0.28, metalness: 0.02 }
			)
		);
	}
	if (index % 2 === 0) {
		house.add(
			box(
				`suburb_house_${index}_chimney`,
				[0.5, 1.2, 0.62],
				[-width * 0.24, wallHeight + 0.96, 0.55],
				0x8f6655,
				{ roughness: 0.98 }
			)
		);
	}
	addStatic(parent, house);
}

function addSuburbTree(parent, index, x, z, scale = 1) {
	const tree = new THREE.Group();
	tree.name = uniqueName(`suburb_tree_${index}`);
	tree.position.set(x, 0, z);
	tree.add(
		cylinder(
			`suburb_tree_${index}_trunk`,
			[0.18 * scale, 0.28 * scale],
			2.6 * scale,
			[0, 1.3 * scale, 0],
			0x6f543b,
			{ segments: 9 }
		)
	);
	for (const [crownIndex, [offsetX, offsetY, offsetZ, radius]] of [
		[0, 3.18, 0, 1.18],
		[-0.72, 2.9, 0.08, 0.88],
		[0.74, 2.95, -0.05, 0.92]
	].entries()) {
		tree.add(
			mesh(
				`suburb_tree_${index}_crown_${crownIndex}`,
				new THREE.DodecahedronGeometry(radius * scale, 1),
				crownIndex % 2 === 0 ? 0x557d49 : 0x668d53,
				[offsetX * scale, offsetY * scale, offsetZ * scale],
				{ roughness: 1 }
			)
		);
	}
	addStatic(parent, tree);
}

function addSuburbScenery(garden) {
	const gardenCenterZ = BACK_WALL_Z - GARDEN_DEPTH / 2;
	addStatic(
		garden,
		mesh(
			'suburb_surrounding_ground',
			new THREE.PlaneGeometry(68, 42),
			0x78925a,
			[0, -0.055, gardenCenterZ - 4],
			{ rotation: [-Math.PI / 2, 0, 0], roughness: 1 }
		)
	);
	for (const [sideIndex, x] of [-17.4, 17.4].entries()) {
		addStatic(
			garden,
			mesh(
				`suburb_side_street_${sideIndex}`,
				new THREE.PlaneGeometry(4.5, GARDEN_DEPTH + 15),
				0x73787a,
				[x, -0.035, gardenCenterZ + 1],
				{ rotation: [-Math.PI / 2, 0, 0], roughness: 0.98 }
			)
		);
		addStatic(
			garden,
			mesh(
				`suburb_sidewalk_${sideIndex}`,
				new THREE.PlaneGeometry(1.35, GARDEN_DEPTH + 15),
				0xc5bba8,
				[x + (sideIndex === 0 ? 2.65 : -2.65), -0.026, gardenCenterZ + 1],
				{ rotation: [-Math.PI / 2, 0, 0], roughness: 0.96 }
			)
		);
	}

	const housePalette = [
		[0xd8c7af, 0x934f42],
		[0xc3d0c5, 0x5b6872],
		[0xe0bd9d, 0x76524d],
		[0xb9c9d0, 0x4f5d62],
		[0xd4c1c2, 0x85584f],
		[0xcbd0aa, 0x675a4d]
	];
	for (const [index, [x, z, rotation]] of [
		[-22.1, -5.8, 0.07],
		[-22.4, -13.2, -0.04],
		[-22, -20.6, 0.06],
		[22.1, -6.2, -0.06],
		[22.4, -13.6, 0.04],
		[22, -21, -0.05]
	].entries()) {
		const colors = housePalette[index];
		addNeighborHouse(garden, index, [x, 0, z], colors[0], colors[1], rotation);
	}

	for (const [index, [x, z, scale]] of [
		[-14.9, -6.2, 0.9],
		[-15.4, -16.4, 1.12],
		[-15.1, -23.4, 0.82],
		[15, -8.4, 1.04],
		[15.3, -17.7, 0.88],
		[14.9, -23.7, 1.08]
	].entries()) {
		addSuburbTree(garden, index, x, z, scale);
	}

	for (const [index, [x, z]] of [
		[-17.4, -8.5],
		[17.4, -18.2]
	].entries()) {
		addStatic(
			garden,
			cylinder(`suburb_lamppost_${index}`, [0.07, 0.1], 4.2, [x, 2.1, z], 0x3e4545, {
				segments: 10
			})
		);
		addStatic(
			garden,
			mesh(
				`suburb_lamppost_${index}_light`,
				new THREE.SphereGeometry(0.24, 10, 7),
				0xf1d9a0,
				[x, 4.05, z],
				{ roughness: 0.28 }
			)
		);
	}
}

function addHouseExterior(exterior) {
	const houseWidth = UPSTAIRS_MAX_X - UPSTAIRS_MIN_X;
	const houseCenterX = (UPSTAIRS_MIN_X + UPSTAIRS_MAX_X) / 2;
	const exteriorZ = BACK_WALL_Z - 0.17;
	const wallColor = 0xd7c5a5;
	const upperWallColor = 0xcbb894;
	const trimColor = 0xead9b9;
	const darkTrimColor = 0x57483c;
	const roofColor = 0x8e493b;
	const windowLeft = WINDOW_CENTER_X - WINDOW_WIDTH / 2;
	const windowRight = WINDOW_CENTER_X + WINDOW_WIDTH / 2;
	const windowBottom = WINDOW_CENTER_Y - WINDOW_HEIGHT / 2;
	const windowTop = WINDOW_CENTER_Y + WINDOW_HEIGHT / 2;
	const backDoorLeft = KITCHEN_BACK_DOOR_X - KITCHEN_BACK_DOOR_WIDTH / 2;
	const backDoorRight = KITCHEN_BACK_DOOR_X + KITCHEN_BACK_DOOR_WIDTH / 2;

	const addFacadePanel = (name, left, right, bottom, top, color = wallColor) => {
		if (right <= left || top <= bottom) return;
		addStatic(
			exterior,
			box(
				name,
				[right - left, top - bottom, 0.16],
				[(left + right) / 2, (bottom + top) / 2, exteriorZ],
				color,
				{ roughness: 0.98 }
			)
		);
	};

	addFacadePanel('exterior_ground_left', UPSTAIRS_MIN_X, windowLeft, 0, ROOM_HEIGHT);
	addFacadePanel('exterior_ground_window_lower', windowLeft, windowRight, 0, windowBottom);
	addFacadePanel('exterior_ground_window_upper', windowLeft, windowRight, windowTop, ROOM_HEIGHT);
	addFacadePanel('exterior_ground_center', windowRight, backDoorLeft, 0, ROOM_HEIGHT);
	addFacadePanel(
		'exterior_ground_door_header',
		backDoorLeft,
		backDoorRight,
		KITCHEN_BACK_DOOR_HEIGHT,
		ROOM_HEIGHT
	);
	addFacadePanel('exterior_ground_right', backDoorRight, UPSTAIRS_MAX_X, 0, ROOM_HEIGHT);
	addFacadePanel(
		'exterior_upper_wall',
		UPSTAIRS_MIN_X,
		UPSTAIRS_MAX_X,
		UPSTAIRS_FLOOR_Y,
		UPSTAIRS_FLOOR_Y + ROOM_HEIGHT,
		upperWallColor
	);

	addStatic(
		exterior,
		box(
			'exterior_foundation_band',
			[houseWidth + 0.08, 0.34, 0.2],
			[houseCenterX, 0.17, exteriorZ - 0.035],
			0x756957,
			{ roughness: 1 }
		)
	);
	addStatic(
		exterior,
		box(
			'exterior_floor_divider',
			[houseWidth + 0.14, 0.22, 0.22],
			[houseCenterX, UPSTAIRS_FLOOR_Y, exteriorZ - 0.04],
			trimColor,
			{ roughness: 0.96 }
		)
	);
	for (const [index, y] of [5.52, 6.34, 7.16, 7.98, 8.8].entries()) {
		addStatic(
			exterior,
			box(
				`exterior_upper_siding_${index}`,
				[houseWidth - 0.18, 0.035, 0.026],
				[houseCenterX, y, exteriorZ - 0.096],
				0xb29e7e,
				{ roughness: 1 }
			)
		);
	}
	for (const [index, x] of [UPSTAIRS_MIN_X + 0.08, UPSTAIRS_MAX_X - 0.08].entries()) {
		addStatic(
			exterior,
			box(
				`exterior_corner_trim_${index}`,
				[0.28, ROOM_HEIGHT * 2, 0.23],
				[x, ROOM_HEIGHT, exteriorZ - 0.04],
				trimColor,
				{ roughness: 0.96 }
			)
		);
	}

	const exteriorFaceZ = exteriorZ - 0.105;
	for (const [name, size, position] of [
		[
			'exterior_window_trim_top',
			[WINDOW_WIDTH + 0.36, 0.19, 0.055],
			[WINDOW_CENTER_X, windowTop + 0.08]
		],
		[
			'exterior_window_trim_bottom',
			[WINDOW_WIDTH + 0.42, 0.22, 0.07],
			[WINDOW_CENTER_X, windowBottom - 0.09]
		],
		[
			'exterior_window_trim_left',
			[0.19, WINDOW_HEIGHT, 0.055],
			[windowLeft - 0.08, WINDOW_CENTER_Y]
		],
		[
			'exterior_window_trim_right',
			[0.19, WINDOW_HEIGHT, 0.055],
			[windowRight + 0.08, WINDOW_CENTER_Y]
		],
		[
			'exterior_back_door_trim_top',
			[KITCHEN_BACK_DOOR_WIDTH + 0.34, 0.2, 0.06],
			[KITCHEN_BACK_DOOR_X, KITCHEN_BACK_DOOR_HEIGHT + 0.08]
		],
		[
			'exterior_back_door_trim_left',
			[0.18, KITCHEN_BACK_DOOR_HEIGHT, 0.06],
			[backDoorLeft - 0.08, KITCHEN_BACK_DOOR_HEIGHT / 2]
		],
		[
			'exterior_back_door_trim_right',
			[0.18, KITCHEN_BACK_DOOR_HEIGHT, 0.06],
			[backDoorRight + 0.08, KITCHEN_BACK_DOOR_HEIGHT / 2]
		]
	]) {
		addStatic(exterior, box(name, size, [position[0], position[1], exteriorFaceZ], darkTrimColor));
	}

	const fakeWindowX = 3.6;
	const fakeWindowY = UPSTAIRS_FLOOR_Y + 2.38;
	const paintZ = exteriorZ - 0.112;
	addStatic(
		exterior,
		box(
			'exterior_fake_window_blue_paint',
			[2.5, 1.72, 0.022],
			[fakeWindowX, fakeWindowY, paintZ],
			0x527f98,
			{ roughness: 1, rotation: [0, 0, -0.012] }
		)
	);
	for (const [name, size, offsetX, offsetY, rotationZ, color] of [
		['top', [2.62, 0.13, 0.028], 0, 0.89, 0.025, 0x35322d],
		['bottom', [2.58, 0.13, 0.028], 0, -0.89, -0.035, 0x35322d],
		['left', [0.13, 1.82, 0.028], -1.29, 0, -0.028, 0x35322d],
		['right', [0.13, 1.8, 0.028], 1.28, 0, 0.04, 0x35322d],
		['cross_vertical', [0.11, 1.58, 0.03], 0.05, 0, -0.045, 0xe7ddc3],
		['cross_horizontal', [2.3, 0.11, 0.03], 0, -0.02, 0.035, 0xe7ddc3],
		['shine_0', [0.48, 0.07, 0.031], -0.65, 0.48, 0.58, 0xc8e0e2],
		['shine_1', [0.3, 0.065, 0.031], -0.37, 0.28, 0.58, 0xc8e0e2]
	]) {
		addStatic(
			exterior,
			box(
				`exterior_fake_window_${name}`,
				size,
				[fakeWindowX + offsetX, fakeWindowY + offsetY, paintZ - 0.016],
				color,
				{ roughness: 1, rotation: [0, 0, rotationZ] }
			)
		);
	}

	const roofHalfDepth = ROOM_DEPTH / 2 + 0.48;
	const roofRise = 2.32;
	const roofAngle = Math.atan2(roofRise, roofHalfDepth);
	const roofSlopeLength = Math.hypot(roofHalfDepth, roofRise);
	for (const [name, z, rotationX] of [
		['back', -roofHalfDepth / 2, -roofAngle],
		['front', roofHalfDepth / 2, roofAngle]
	]) {
		addStatic(
			exterior,
			box(
				`exterior_roof_${name}`,
				[houseWidth + 0.9, 0.26, roofSlopeLength + 0.25],
				[houseCenterX, UPSTAIRS_FLOOR_Y + ROOM_HEIGHT + roofRise / 2, z],
				roofColor,
				{ roughness: 0.94, rotation: [rotationX, 0, 0] }
			)
		);
	}
	addStatic(
		exterior,
		box(
			'exterior_roof_ridge',
			[houseWidth + 0.94, 0.31, 0.38],
			[houseCenterX, UPSTAIRS_FLOOR_Y + ROOM_HEIGHT + roofRise, 0],
			0x71382f,
			{ roughness: 0.95 }
		)
	);
	addStatic(
		exterior,
		cylinder(
			'exterior_back_gutter',
			[0.09, 0.09],
			houseWidth + 0.75,
			[houseCenterX, UPSTAIRS_FLOOR_Y + ROOM_HEIGHT + 0.02, BACK_WALL_Z - 0.43],
			0x4d4c43,
			{ segments: 12, rotation: [0, 0, Math.PI / 2], roughness: 0.78, metalness: 0.18 }
		)
	);

	const gableShape = new THREE.Shape();
	gableShape.moveTo(-roofHalfDepth, 0);
	gableShape.lineTo(roofHalfDepth, 0);
	gableShape.lineTo(0, roofRise);
	gableShape.closePath();
	for (const [name, x, rotationY] of [
		['left', UPSTAIRS_MIN_X - 0.1, -Math.PI / 2],
		['right', UPSTAIRS_MAX_X + 0.1, Math.PI / 2]
	]) {
		addStatic(
			exterior,
			mesh(
				`exterior_gable_${name}`,
				new THREE.ShapeGeometry(gableShape),
				upperWallColor,
				[x, UPSTAIRS_FLOOR_Y + ROOM_HEIGHT, 0],
				{ roughness: 0.98, rotation: [0, rotationY, 0] }
			)
		);
	}
	for (const [name, x] of [
		['left', UPSTAIRS_MIN_X - 0.1],
		['right', UPSTAIRS_MAX_X + 0.1]
	]) {
		addStatic(
			exterior,
			box(
				`exterior_side_wall_${name}`,
				[0.18, ROOM_HEIGHT * 2, ROOM_DEPTH + 0.3],
				[x, ROOM_HEIGHT, 0],
				wallColor,
				{ roughness: 0.98 }
			)
		);
	}

	addStatic(
		exterior,
		box(
			'exterior_planting_bed',
			[houseWidth - 1.1, 0.14, 1.06],
			[houseCenterX, 0.04, BACK_WALL_Z - 0.7],
			0x574636,
			{ roughness: 1 }
		)
	);
	for (const [shrubIndex, [x, scale]] of [
		[-11.8, 0.92],
		[-9.45, 0.72],
		[-1.65, 0.82],
		[0.55, 0.66],
		[6.7, 0.9],
		[9.25, 0.74]
	].entries()) {
		const shrub = new THREE.Group();
		shrub.name = uniqueName(`exterior_house_shrub_${shrubIndex}`);
		shrub.position.set(x, 0, BACK_WALL_Z - 0.72 - (shrubIndex % 2) * 0.06);
		for (const [lobeIndex, [offsetX, offsetY, lobeScale]] of [
			[-0.36, 0.48, 0.72],
			[0.03, 0.61, 0.92],
			[0.42, 0.43, 0.66]
		].entries()) {
			shrub.add(
				mesh(
					`exterior_house_shrub_${shrubIndex}_lobe_${lobeIndex}`,
					new THREE.DodecahedronGeometry(0.58, 1),
					lobeIndex === 1 ? 0x537944 : 0x648b4d,
					[offsetX * scale, offsetY * scale, (lobeIndex - 1) * 0.09],
					{
						scale: [lobeScale * scale, lobeScale * scale, lobeScale * 0.72 * scale],
						roughness: 1
					}
				)
			);
		}
		if (shrubIndex % 2 === 0) {
			for (const [flowerIndex, [offsetX, offsetY]] of [
				[-0.22, 0.72],
				[0.28, 0.58]
			].entries()) {
				shrub.add(
					mesh(
						`exterior_house_shrub_${shrubIndex}_flower_${flowerIndex}`,
						new THREE.SphereGeometry(0.075, 8, 6),
						shrubIndex % 4 === 0 ? 0xe3a24e : 0xd68786,
						[offsetX * scale, offsetY * scale, -0.48 * scale],
						{ roughness: 0.9 }
					)
				);
			}
		}
		addStatic(exterior, shrub);
	}
	addStatic(
		exterior,
		cylinder(
			'exterior_drainpipe',
			[0.065, 0.075],
			ROOM_HEIGHT * 1.88,
			[10.55, ROOM_HEIGHT * 0.94, exteriorFaceZ - 0.08],
			0x74756c,
			{ segments: 10, roughness: 0.72, metalness: 0.16 }
		)
	);
}

function addGarden(garden) {
	const gardenCenterZ = BACK_WALL_Z - GARDEN_DEPTH / 2;
	addSuburbScenery(garden);
	addCollider(
		garden,
		mesh(
			'garden_lawn',
			new THREE.PlaneGeometry(GARDEN_WIDTH, GARDEN_DEPTH),
			0x789b55,
			[0, -0.006, gardenCenterZ],
			{
				rotation: [-Math.PI / 2, 0, 0],
				roughness: 0.96
			}
		),
		'floor',
		'grass'
	);
	addStatic(
		garden,
		mesh('garden_patio', new THREE.CircleGeometry(3.4, 36), 0xc9b89c, [-1.8, 0.012, -10.1], {
			rotation: [-Math.PI / 2, 0, 0],
			scale: [1, 1, 0.72],
			roughness: 0.94
		})
	);
	for (let index = 0; index < 7; index += 1) {
		const stone = cylinder(
			`garden_stone_${index}`,
			[0.42 + (index % 2) * 0.08, 0.46 + (index % 2) * 0.08],
			0.055,
			[WINDOW_CENTER_X + Math.sin(index * 0.9) * 0.34, 0.022, BACK_WALL_Z - 1.1 - index * 0.72],
			index % 2 ? 0xd7c7aa : 0xbda98d,
			{ segments: 12, rotation: [0, index * 0.63, 0] }
		);
		addStatic(garden, stone);
	}
	for (const [name, size, position] of [
		['garden_left_hedge', [0.55, 2.65, GARDEN_DEPTH], [-GARDEN_WIDTH / 2, 1.3, gardenCenterZ]],
		['garden_right_hedge', [0.55, 2.65, GARDEN_DEPTH], [GARDEN_WIDTH / 2, 1.3, gardenCenterZ]],
		['garden_back_hedge', [GARDEN_WIDTH, 2.65, 0.55], [0, 1.3, GARDEN_BACK_Z]]
	]) {
		addCollider(garden, box(name, size, position, 0x4f753f, { roughness: 0.98 }), 'wall', 'grass');
	}
	let shrubIndex = 0;
	for (let x = -9; x <= 9; x += 3) {
		if (Math.abs(x - DOGHOUSE_X) < 1.4) continue;
		addStatic(
			garden,
			mesh(
				`garden_shrub_${shrubIndex++}`,
				new THREE.DodecahedronGeometry(0.75, 1),
				0x648a49,
				[x, 0.65, GARDEN_BACK_Z + 0.55],
				{
					scale: [1.3, 1, 0.75],
					roughness: 0.95
				}
			)
		);
	}
	const dogBone = new THREE.Group();
	dogBone.name = uniqueName('garden_dog_bone');
	dogBone.position.set(DOGHOUSE_X - 0.15, 0.055, DOGHOUSE_Z + 1.78);
	dogBone.rotation.y = -0.32;
	dogBone.add(box('garden_dog_bone_center', [0.62, 0.12, 0.15], [0, 0.1, 0], 0xe7dfcd));
	let dogBoneEndIndex = 0;
	for (const x of [-0.36, 0.36]) {
		for (const z of [-0.08, 0.08]) {
			dogBone.add(
				mesh(
					`garden_dog_bone_end_${dogBoneEndIndex++}`,
					new THREE.SphereGeometry(0.13, 10, 8),
					0xe7dfcd,
					[x, 0.1, z]
				)
			);
		}
	}
	addStatic(garden, dogBone);
	addStatic(
		garden,
		box(
			'garden_exterior_trim',
			[ROOM_WIDTH - 0.2, 0.22, 0.16],
			[0, 0.11, BACK_WALL_Z - 0.1],
			0xbca88b
		)
	);
}

const houseShell = zone('house_shell', 'ground');
const living = zone('living_room', 'ground');
const houseExterior = zone('house_exterior', 'outside');
const bathroom = zone('bathroom', 'ground', 'left_door_bathroom');
const stairs = zone('stairs', 'ground', 'left_door_stairs');
const bedroom = zone('bedroom', 'ground', 'left_door_bedroom');
const kitchen = zone('kitchen', 'ground', 'kitchen_door');
const garden = zone('garden', 'outside');
const upstairs = zone('upstairs', 'upstairs', 'left_door_stairs');
const basement = zone('basement', 'basement', 'kitchen_hatch');
const sewer = zone('sewer', 'sewer', 'toilet');

addLivingRoom(living);
addHouseExterior(houseExterior);
addLeftRooms(houseShell, bathroom, stairs, bedroom);
addKitchen(houseShell, kitchen);
addGarden(garden);
addUpstairs(houseShell, upstairs);
addBasement(basement);
addSewer(sewer);

root.updateMatrixWorld(true);
const exporter = new GLTFExporter();
const result = await exporter.parseAsync(root, {
	binary: true,
	onlyVisible: false,
	includeCustomExtensions: true
});

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'static', 'game', 'levels');
const modelFilename = 'stampkonijn-house.glb';
const manifestFilename = 'stampkonijn-house.level.json';
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, modelFilename), Buffer.from(result));
await writeFile(
	path.join(outputDirectory, manifestFilename),
	`${JSON.stringify(
		{
			version: 1,
			id: 'stampkonijn-house',
			model: `./${modelFilename}`,
			zones,
			entities: [],
			colliders
		},
		null,
		2
	)}\n`
);

console.log(`Exported ${path.relative(repositoryRoot, path.join(outputDirectory, modelFilename))}`);
console.log(
	`Exported ${path.relative(repositoryRoot, path.join(outputDirectory, manifestFilename))}`
);
console.log(`${zones.length} zones, ${colliders.length} gameplay surfaces`);
