import { NodeIO, getBounds } from '@gltf-transform/core';
import { dedup } from '@gltf-transform/functions';
import assert from 'node:assert/strict';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) {
	throw new Error('Usage: node scripts/fix-pistol-model.mjs <input.glb> <output.glb>');
}

// Measured from this specific source model in its baked, world-space orientation.
// The grip point sits inside the upper grip where the rabbit hand should hold it.
const GRIP_POINT = [-0.052, -0.038, 0];
const MUZZLE_POINT = [0.107598, 0.034798, 0];
const PART_NAMES = ['pistol_slide', 'pistol_sights', 'pistol_trigger', 'pistol_frame', 'pistol_barrel'];

const io = new NodeIO();
const document = await io.read(inputPath);
const root = document.getRoot();
const oldScenes = root.listScenes();
const oldNodes = root.listNodes();
const meshNodes = oldNodes.filter((node) => node.getMesh());

if (root.listCameras().length > 0) {
	for (const camera of root.listCameras()) camera.dispose();
}

function transformPoint(matrix, point) {
	const [x, y, z] = point;
	return [
		matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
		matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
		matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
	];
}

function transformDirection(matrix, direction) {
	const [x, y, z] = direction;
	const transformed = [
		matrix[0] * x + matrix[4] * y + matrix[8] * z,
		matrix[1] * x + matrix[5] * y + matrix[9] * z,
		matrix[2] * x + matrix[6] * y + matrix[10] * z
	];
	const length = Math.hypot(...transformed) || 1;
	return transformed.map((value) => value / length);
}

// Rotating -90 degrees around Y maps the source model's +X barrel axis to +Z.
function orient([x, y, z]) {
	return [-z, y, x];
}

const orientedGrip = orient(GRIP_POINT);
const orientAroundGrip = (point) => orient(point).map((value, axis) => value - orientedGrip[axis]);

for (const [nodeIndex, node] of meshNodes.entries()) {
	const worldMatrix = node.getWorldMatrix().slice();
	const mesh = node.getMesh();
	for (const primitive of mesh.listPrimitives()) {
		const texcoord = primitive.getAttribute('TEXCOORD_0');
		if (texcoord) {
			primitive.setAttribute('TEXCOORD_0', null);
			texcoord.dispose();
		}

		const position = primitive.getAttribute('POSITION');
		if (position) {
			const source = position.getArray();
			const baked = new Float32Array(source.length);
			for (let index = 0; index < source.length; index += 3) {
				const worldPoint = transformPoint(worldMatrix, [source[index], source[index + 1], source[index + 2]]);
				const [x, y, z] = orientAroundGrip(worldPoint);
				baked.set([x, y, z], index);
			}
			position.setArray(baked);
		}

		const normal = primitive.getAttribute('NORMAL');
		if (normal) {
			const source = normal.getArray();
			const baked = new Float32Array(source.length);
			for (let index = 0; index < source.length; index += 3) {
				const worldNormal = transformDirection(worldMatrix, [
					source[index],
					source[index + 1],
					source[index + 2]
				]);
				const orientedNormal = orient(worldNormal);
				const length = Math.hypot(...orientedNormal) || 1;
				baked.set(orientedNormal.map((value) => value / length), index);
			}
			normal.setArray(baked);
		}
	}

	const partName = PART_NAMES[nodeIndex] ?? `pistol_part_${String(nodeIndex + 1).padStart(2, '0')}`;
	node.setName(partName);
	mesh.setName(partName);
	node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
}

const scene = document.createScene('Pistol_Scene');
const grip = document
	.createNode('pistol_grip')
	.setExtras({ role: 'grip_origin', forwardAxis: '+Z', upAxis: '+Y', units: 'meters' });
const muzzle = document
	.createNode('pistol_muzzle')
	.setTranslation(orientAroundGrip(MUZZLE_POINT))
	.setExtras({ role: 'muzzle', forwardAxis: '+Z' });

for (const node of meshNodes) grip.addChild(node);
grip.addChild(muzzle);
scene.addChild(grip);
root.setDefaultScene(scene);

for (const node of oldNodes) {
	if (!meshNodes.includes(node)) node.dispose();
}
for (const oldScene of oldScenes) oldScene.dispose();

const asset = root.getAsset();
asset.generator = 'Codex pistol prep with glTF-Transform 4.4.2';
asset.extras = {
	...(asset.extras ?? {}),
	preparation: {
		gripOrigin: 'pistol_grip at [0,0,0]',
		forwardAxis: '+Z',
		upAxis: '+Y',
		units: 'meters',
		muzzleNode: 'pistol_muzzle'
	}
};

await document.transform(dedup());
const bounds = getBounds(root.getDefaultScene());
const boundsSize = bounds.max.map((value, axis) => value - bounds.min[axis]);

assert.equal(root.listScenes().length, 1, 'Expected exactly one scene.');
assert.equal(root.listCameras().length, 0, 'Expected no cameras.');
assert.equal(root.getDefaultScene().listChildren().length, 1, 'Expected one scene root.');
assert.equal(root.getDefaultScene().listChildren()[0].getName(), 'pistol_grip');
assert.equal(muzzle.getParentNode(), grip, 'The muzzle must be a child of the grip root.');
assert.ok(boundsSize[2] > boundsSize[0] && boundsSize[2] > boundsSize[1], '+Z must be the long axis.');
assert.ok(muzzle.getTranslation()[2] >= bounds.max[2] - 0.001, 'Muzzle must sit at the +Z tip.');
for (const node of meshNodes) {
	assert.deepEqual(node.getTranslation(), [0, 0, 0]);
	assert.deepEqual(node.getRotation(), [0, 0, 0, 1]);
	assert.deepEqual(node.getScale(), [1, 1, 1]);
}

await io.write(outputPath, document);

console.log(
	JSON.stringify(
		{
			outputPath,
			bounds,
			muzzle: muzzle.getTranslation(),
			nodes: root.listNodes().map((node) => ({
				name: node.getName(),
				translation: node.getTranslation(),
				rotation: node.getRotation(),
				scale: node.getScale()
			}))
		},
		null,
		2
	)
);
