/**
 * Batch 5 (MeasuredTemplate → Regions) regression tests against live V14:
 * every Nimble AoE template shape converts to a valid Region shape, the
 * created Region documents round-trip through the scene database, and region
 * containment (the basis for AoE auto-targeting) behaves correctly.
 *
 * buildAoERegionShape is a pure function with no module state, so importing
 * it from source into the live page is safe.
 */

import { afterAll, describe, expect, test } from 'vitest';
import {
	type AoETemplateConfig,
	buildAoERegionShape,
} from '../../src/canvas/buildAoERegionShape.ts';

const TEST_SCENE_NAME = 'V14 AoE Region Test Scene';
const GRID_SIZE = 100;

describe('AoE regions', () => {
	afterAll(async () => {
		const leftovers = game.scenes.filter((scene) => scene.name === TEST_SCENE_NAME);
		for (const leftover of leftovers) {
			await leftover.delete().catch((error) => console.error(error));
		}
	});

	async function createTestScene() {
		const scene = await Scene.create({
			name: TEST_SCENE_NAME,
			width: 4000,
			height: 3000,
			grid: { type: CONST.GRID_TYPES.SQUARE, size: GRID_SIZE, distance: 1, units: 'spaces' },
		});
		expect(scene).toBeDefined();
		return scene!;
	}

	test('every AoE template shape converts to a valid Region shape', () => {
		const origin = { x: 1000, y: 1000 };
		const cases: Array<[AoETemplateConfig['shape'], string]> = [
			['circle', 'circle'],
			['emanation', 'circle'],
			['cone', 'cone'],
			['line', 'line'],
			['square', 'rectangle'],
		];

		for (const [shape, regionType] of cases) {
			const result = buildAoERegionShape(
				{ shape, length: 6, radius: 3, width: 2 },
				{ origin, rotation: 0, gridSize: GRID_SIZE },
			);
			expect(result, `${shape} should convert`).toBeTruthy();
			expect(result!.type, `${shape} maps to region type ${regionType}`).toBe(regionType);
		}

		expect(
			buildAoERegionShape(
				{ shape: '', length: 1, radius: 1, width: 1 },
				{ origin, rotation: 0, gridSize: GRID_SIZE },
			),
		).toBeNull();
	});

	test('AoE regions round-trip through the scene database for every shape', async () => {
		const scene = await createTestScene();

		for (const shape of ['circle', 'emanation', 'cone', 'line', 'square'] as const) {
			const regionShape = buildAoERegionShape(
				{ shape, length: 6, radius: 3, width: 2 },
				{ origin: { x: 1000, y: 1000 }, rotation: 90, gridSize: GRID_SIZE },
			);

			const [region] = await scene.createEmbeddedDocuments('Region', [
				{
					name: `AoE ${shape}`,
					shapes: [regionShape],
					visibility: CONST.REGION_VISIBILITY.ALWAYS,
				} as unknown as RegionDocument.CreateData,
			]);

			expect(region, `${shape} region should be created`).toBeDefined();
			const stored = scene.regions.get(region!.id!)!;
			expect(stored.shapes.length).toBe(1);
			expect((stored.shapes[0] as unknown as { type: string }).type).toBe(
				(regionShape as { type: string }).type,
			);
			expect(stored.visibility).toBe(CONST.REGION_VISIBILITY.ALWAYS);
		}

		await scene.delete();
	});

	test('region containment matches the placed circle (AoE auto-target basis)', async () => {
		const scene = await createTestScene();

		const regionShape = buildAoERegionShape(
			{ shape: 'circle', length: 1, radius: 3, width: 1 },
			{ origin: { x: 1000, y: 1000 }, rotation: 0, gridSize: GRID_SIZE },
		);

		const [region] = (await scene.createEmbeddedDocuments('Region', [
			{ name: 'AoE containment', shapes: [regionShape] } as unknown as RegionDocument.CreateData,
		])) as RegionDocument[];

		// Center and a point one square out are inside a 3-square radius;
		// a point five squares out is not.
		expect(region!.testPoint({ x: 1000, y: 1000, elevation: 0 })).toBe(true);
		expect(region!.testPoint({ x: 1100, y: 1000, elevation: 0 })).toBe(true);
		expect(region!.testPoint({ x: 1000 + 5 * GRID_SIZE, y: 1000, elevation: 0 })).toBe(false);

		await scene.delete();
	});
});
