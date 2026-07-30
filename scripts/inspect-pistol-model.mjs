import { NodeIO, getBounds } from '@gltf-transform/core';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: node scripts/inspect-pistol-model.mjs <model.glb>');

const document = await new NodeIO().read(inputPath);
const root = document.getRoot();

function summarizePoints(points) {
	if (!points.length) return null;
	const summarizeAxis = (axis) => {
		const values = points.map((point) => point[axis]).sort((a, b) => a - b);
		return {
			min: values[0],
			q25: values[Math.floor((values.length - 1) * 0.25)],
			median: values[Math.floor((values.length - 1) * 0.5)],
			q75: values[Math.floor((values.length - 1) * 0.75)],
			max: values[values.length - 1]
		};
	};
	return {
		count: points.length,
		x: summarizeAxis(0),
		y: summarizeAxis(1),
		z: summarizeAxis(2)
	};
}

function getWorldPoints(node) {
	const matrix = node.getWorldMatrix();
	const points = [];
	for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
		const position = primitive.getAttribute('POSITION');
		if (!position) continue;
		const element = [0, 0, 0];
		for (let index = 0; index < position.getCount(); index += 1) {
			position.getElement(index, element);
			const [x, y, z] = element;
			points.push([
				matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
				matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
				matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
			]);
		}
	}
	return points;
}

console.log(
	JSON.stringify(
		{
			asset: root.getAsset(),
			scenes: root.listScenes().map((scene) => ({
				name: scene.getName(),
				bounds: getBounds(scene),
				children: scene.listChildren().map((node) => node.getName())
			})),
			cameras: root.listCameras().map((camera) => camera.getName()),
			materials: root.listMaterials().map((material) => ({
				name: material.getName(),
				baseColorFactor: material.getBaseColorFactor(),
				metallicFactor: material.getMetallicFactor(),
				roughnessFactor: material.getRoughnessFactor()
			})),
			nodes: root.listNodes().map((node) => {
				const worldPoints = getWorldPoints(node);
				return {
				name: node.getName(),
				parent: node.getParentNode()?.getName() ?? null,
				mesh: node.getMesh()?.getName() ?? null,
				translation: node.getTranslation(),
				rotation: node.getRotation(),
				scale: node.getScale(),
				worldMatrix: node.getWorldMatrix(),
				bounds: node.getMesh() ? getBounds(node) : null,
				materials:
					node
						.getMesh()
						?.listPrimitives()
						.map((primitive) => primitive.getMaterial()?.getName() ?? null) ?? [],
				vertexSlices: node.getMesh()
					? {
						all: summarizePoints(worldPoints),
						grip: summarizePoints(worldPoints.filter((point) => point[1] < -0.025)),
						top: summarizePoints(worldPoints.filter((point) => point[1] > 0.025)),
						muzzle: summarizePoints(worldPoints.filter((point) => point[0] > 0.1))
					}
					: null
				};
			})
		},
		null,
		2
	)
);
