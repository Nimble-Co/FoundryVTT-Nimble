import { describe, expect, it, vi } from 'vitest';
import { NimbleScene } from './scene.js';

function createSceneForPreCreate({
	gridUnits = 'feet',
	gridDistance = 5,
	tokenSightRange = 30,
	ambientSoundRadius = 60,
}: {
	gridUnits?: string;
	gridDistance?: number;
	tokenSightRange?: number;
	ambientSoundRadius?: number;
} = {}) {
	const scene = new NimbleScene({} as Scene.CreateData);

	const sceneUpdateSource = vi.fn();
	const tokenUpdateSource = vi.fn();
	const soundUpdateSource = vi.fn();

	Object.assign(scene, {
		grid: {
			units: gridUnits,
			distance: gridDistance,
		},
		lights: { contents: [] },
		tokens: {
			contents: [
				{
					sight: { range: tokenSightRange },
					updateSource: tokenUpdateSource,
				},
			],
		},
		sounds: {
			contents: [
				{
					radius: ambientSoundRadius,
					updateSource: soundUpdateSource,
				},
			],
		},
		updateSource: sceneUpdateSource,
	});

	return {
		scene,
		sceneUpdateSource,
		tokenUpdateSource,
		soundUpdateSource,
	};
}

describe('NimbleScene _preCreate conversion', () => {
	it('converts token vision range and ambient sound radius from feet to spaces', async () => {
		const { scene, sceneUpdateSource, tokenUpdateSource, soundUpdateSource } =
			createSceneForPreCreate({
				gridUnits: 'feet',
				gridDistance: 5,
				tokenSightRange: 30,
				ambientSoundRadius: 60,
			});

		await (scene as any)._preCreate({}, {}, {});

		expect(sceneUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'grid.distance': 1,
				'grid.units': 'spaces',
			}),
			expect.any(Object),
		);
		expect(tokenUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'sight.range': 6,
			}),
		);
		expect(soundUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				radius: 12,
			}),
		);
	});

	it('does not convert when scene grid is not eligible for conversion', async () => {
		const { scene, sceneUpdateSource, tokenUpdateSource, soundUpdateSource } =
			createSceneForPreCreate({
				gridUnits: 'feet',
				gridDistance: 7,
				tokenSightRange: 30,
				ambientSoundRadius: 60,
			});

		await (scene as any)._preCreate({}, {}, {});

		expect(sceneUpdateSource).not.toHaveBeenCalled();
		expect(tokenUpdateSource).not.toHaveBeenCalled();
		expect(soundUpdateSource).not.toHaveBeenCalled();
	});
});
