export const LEVEL_MANIFEST_VERSION = 1;

export type LevelBiome = 'ground' | 'basement' | 'sewer' | 'upstairs' | 'outside';
export type ColliderShape = 'mesh' | 'box';

export interface LevelZoneManifest {
	id: string;
	node: string;
	biome: LevelBiome;
	enabledBy?: string;
}

export interface LevelEntityManifest {
	id: string;
	node: string;
	kind: string;
	zone: string;
	properties: Record<string, unknown>;
}

export interface LevelColliderManifest {
	id: string;
	node: string;
	zone: string;
	shape: ColliderShape;
}

export interface LevelManifest {
	version: typeof LEVEL_MANIFEST_VERSION;
	id: string;
	model: string;
	zones: LevelZoneManifest[];
	entities: LevelEntityManifest[];
	colliders: LevelColliderManifest[];
}

export function parseLevelManifest(input: unknown): LevelManifest {
	if (!isRecord(input)) throw new Error('Level manifest must be an object.');
	if (input.version !== LEVEL_MANIFEST_VERSION) {
		throw new Error(`Unsupported level manifest version: ${String(input.version)}.`);
	}

	const zones = readArray(input.zones, 'zones').map((zone, index) => parseZone(zone, index));
	const zoneIds = new Set(zones.map((zone) => zone.id));
	assertUnique(
		zones.map((zone) => zone.id),
		'zone id'
	);
	assertUnique(
		zones.map((zone) => zone.node),
		'zone node'
	);

	const entities = readArray(input.entities, 'entities').map((entity, index) =>
		parseEntity(entity, index, zoneIds)
	);
	const colliders = readArray(input.colliders, 'colliders').map((collider, index) =>
		parseCollider(collider, index, zoneIds)
	);
	assertUnique(
		entities.map((entity) => entity.id),
		'entity id'
	);
	assertUnique(
		colliders.map((collider) => collider.id),
		'collider id'
	);

	return {
		version: LEVEL_MANIFEST_VERSION,
		id: readString(input.id, 'id'),
		model: readString(input.model, 'model'),
		zones,
		entities,
		colliders
	};
}

function parseZone(input: unknown, index: number): LevelZoneManifest {
	if (!isRecord(input)) throw new Error(`zones[${index}] must be an object.`);
	const biome = readString(input.biome, `zones[${index}].biome`);
	if (!isLevelBiome(biome)) throw new Error(`Unknown biome '${biome}' in zones[${index}].`);
	return {
		id: readString(input.id, `zones[${index}].id`),
		node: readString(input.node, `zones[${index}].node`),
		biome,
		...(typeof input.enabledBy === 'string' ? { enabledBy: input.enabledBy } : {})
	};
}

function parseEntity(input: unknown, index: number, zoneIds: Set<string>): LevelEntityManifest {
	if (!isRecord(input)) throw new Error(`entities[${index}] must be an object.`);
	const zone = readString(input.zone, `entities[${index}].zone`);
	assertKnownZone(zone, zoneIds, `entities[${index}]`);
	return {
		id: readString(input.id, `entities[${index}].id`),
		node: readString(input.node, `entities[${index}].node`),
		kind: readString(input.kind, `entities[${index}].kind`),
		zone,
		properties: isRecord(input.properties) ? input.properties : {}
	};
}

function parseCollider(input: unknown, index: number, zoneIds: Set<string>): LevelColliderManifest {
	if (!isRecord(input)) throw new Error(`colliders[${index}] must be an object.`);
	const zone = readString(input.zone, `colliders[${index}].zone`);
	assertKnownZone(zone, zoneIds, `colliders[${index}]`);
	const shape = readString(input.shape, `colliders[${index}].shape`);
	if (shape !== 'mesh' && shape !== 'box') {
		throw new Error(`Unknown collider shape '${shape}' in colliders[${index}].`);
	}
	return {
		id: readString(input.id, `colliders[${index}].id`),
		node: readString(input.node, `colliders[${index}].node`),
		zone,
		shape
	};
}

function assertKnownZone(zone: string, zoneIds: Set<string>, location: string) {
	if (!zoneIds.has(zone)) throw new Error(`${location} references unknown zone '${zone}'.`);
}

function assertUnique(values: string[], label: string) {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) throw new Error(`Duplicate ${label}: '${value}'.`);
		seen.add(value);
	}
}

function readArray(input: unknown, name: string): unknown[] {
	if (!Array.isArray(input)) throw new Error(`Level manifest '${name}' must be an array.`);
	return input;
}

function readString(input: unknown, name: string): string {
	if (typeof input !== 'string' || input.trim() === '') {
		throw new Error(`Level manifest '${name}' must be a non-empty string.`);
	}
	return input;
}

function isRecord(input: unknown): input is Record<string, unknown> {
	return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isLevelBiome(input: string): input is LevelBiome {
	return ['ground', 'basement', 'sewer', 'upstairs', 'outside'].includes(input);
}
