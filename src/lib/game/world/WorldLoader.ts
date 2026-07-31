import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { parseLevelManifest, type LevelManifest } from './LevelManifest';

export interface LoadedWorld {
	manifest: LevelManifest;
	root: THREE.Group;
	zones: Map<string, THREE.Object3D>;
	entities: Map<string, THREE.Object3D>;
	colliders: Map<string, THREE.Object3D>;
}

export class WorldLoader {
	constructor(private readonly loader = new GLTFLoader()) {}

	async load(manifestUrl: string): Promise<LoadedWorld> {
		const response = await fetch(manifestUrl);
		if (!response.ok) {
			throw new Error(`Could not load level manifest '${manifestUrl}': ${response.status}.`);
		}
		const manifest = parseLevelManifest(await response.json());
		const modelUrl = new URL(manifest.model, new URL(manifestUrl, window.location.href)).toString();
		const gltf = await this.loader.loadAsync(modelUrl);
		const nodes = indexNodes(gltf.scene);

		return {
			manifest,
			root: gltf.scene,
			zones: mapNodes(manifest.zones, nodes, 'zone'),
			entities: mapNodes(manifest.entities, nodes, 'entity'),
			colliders: mapNodes(manifest.colliders, nodes, 'collider')
		};
	}

	setZoneVisible(world: LoadedWorld, zoneId: string, visible: boolean) {
		const zone = world.zones.get(zoneId);
		if (!zone) throw new Error(`Unknown level zone '${zoneId}'.`);
		zone.visible = visible;
	}
}

function indexNodes(root: THREE.Object3D) {
	const nodes = new Map<string, THREE.Object3D>();
	root.traverse((node) => {
		if (!node.name) return;
		if (nodes.has(node.name)) throw new Error(`Duplicate node name in level GLB: '${node.name}'.`);
		nodes.set(node.name, node);
	});
	return nodes;
}

function mapNodes(
	items: Array<{ id: string; node: string }>,
	nodes: Map<string, THREE.Object3D>,
	kind: string
) {
	const result = new Map<string, THREE.Object3D>();
	for (const item of items) {
		const node = nodes.get(item.node);
		if (!node) throw new Error(`Missing ${kind} node '${item.node}' in level GLB.`);
		result.set(item.id, node);
	}
	return result;
}
