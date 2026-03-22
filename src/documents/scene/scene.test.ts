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

async function runPreCreate(scene: NimbleScene): Promise<void> {
	const preCreateScene = scene as unknown as {
		_preCreate: (
			data: Scene.CreateData,
			options: Scene.Database.PreCreateOptions,
			user: User.Implementation,
		) => Promise<boolean | undefined>;
	};

	await preCreateScene._preCreate(
		{} as Scene.CreateData,
		{} as Scene.Database.PreCreateOptions,
		{} as User.Implementation,
	);
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

		await runPreCreate(scene);

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

		await runPreCreate(scene);

		expect(sceneUpdateSource).not.toHaveBeenCalled();
		expect(tokenUpdateSource).not.toHaveBeenCalled();
		expect(soundUpdateSource).not.toHaveBeenCalled();
	});

	it('converts ambient light range from feet to spaces', async () => {
		const { scene } = createSceneForPreCreate({
			gridUnits: 'feet',
			gridDistance: 5,
		});

		const lightUpdateSource = vi.fn();
		Object.assign(scene, {
			lights: {
				contents: [
					{
						config: { dim: 25, bright: 10 },
						updateSource: lightUpdateSource,
					},
				],
			},
		});

		await runPreCreate(scene);

		expect(lightUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'config.dim': 5,
				'config.bright': 2,
			}),
		);
	});

	it('converts token light and vision ranges together', async () => {
		const { scene } = createSceneForPreCreate({
			gridUnits: 'feet',
			gridDistance: 5,
		});

		const tokenUpdateSource = vi.fn();
		Object.assign(scene, {
			tokens: {
				contents: [
					{
						light: { dim: 30, bright: 15 },
						sight: { range: 45 },
						updateSource: tokenUpdateSource,
					},
				],
			},
		});

		await runPreCreate(scene);

		expect(tokenUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'light.dim': 6,
				'light.bright': 3,
				'sight.range': 9,
			}),
		);
	});

	it('converts token light range when token has no vision range', async () => {
		const { scene } = createSceneForPreCreate({
			gridUnits: 'feet',
			gridDistance: 5,
		});

		const tokenUpdateSource = vi.fn();
		Object.assign(scene, {
			tokens: {
				contents: [
					{
						light: { dim: 20, bright: 10 },
						updateSource: tokenUpdateSource,
					},
				],
			},
		});

		await runPreCreate(scene);

		expect(tokenUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'light.dim': 4,
				'light.bright': 2,
			}),
		);

		const tokenUpdatePayload = tokenUpdateSource.mock.calls[0][0] as Record<string, unknown>;
		expect(tokenUpdatePayload['sight.range']).toBeUndefined();
	});

	it('converts when grid units use ft abbreviation', async () => {
		const { scene, sceneUpdateSource, tokenUpdateSource, soundUpdateSource } =
			createSceneForPreCreate({
				gridUnits: 'ft',
				gridDistance: 5,
				tokenSightRange: 30,
				ambientSoundRadius: 60,
			});

		await runPreCreate(scene);

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

	it('treats grid distance of 0 as eligible for conversion', async () => {
		const { scene, sceneUpdateSource } = createSceneForPreCreate({
			gridUnits: 'feet',
			gridDistance: 0,
			tokenSightRange: 30,
			ambientSoundRadius: 60,
		});

		await runPreCreate(scene);

		expect(sceneUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'grid.distance': 0,
				'grid.units': 'spaces',
			}),
			expect.any(Object),
		);
	});

	it('handles eligible scenes with empty light, token, and sound collections', async () => {
		const { scene, sceneUpdateSource, tokenUpdateSource, soundUpdateSource } =
			createSceneForPreCreate({
				gridUnits: 'feet',
				gridDistance: 5,
			});

		Object.assign(scene, {
			lights: { contents: [] },
			tokens: { contents: [] },
			sounds: { contents: [] },
		});

		await runPreCreate(scene);

		expect(sceneUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'grid.distance': 1,
				'grid.units': 'spaces',
			}),
			expect.any(Object),
		);
		expect(tokenUpdateSource).not.toHaveBeenCalled();
		expect(soundUpdateSource).not.toHaveBeenCalled();
	});

	it('skips scene elements without updateSource while converting valid elements', async () => {
		const { scene, sceneUpdateSource, tokenUpdateSource, soundUpdateSource } =
			createSceneForPreCreate({
				gridUnits: 'feet',
				gridDistance: 5,
				tokenSightRange: 30,
				ambientSoundRadius: 60,
			});

		const lightUpdateSource = vi.fn();
		Object.assign(scene, {
			lights: {
				contents: [
					{
						config: { dim: 30, bright: 15 },
					},
					{
						config: { dim: 30, bright: 15 },
						updateSource: lightUpdateSource,
					},
				],
			},
			tokens: {
				contents: [
					{
						sight: { range: 30 },
					},
					{
						sight: { range: 30 },
						updateSource: tokenUpdateSource,
					},
				],
			},
			sounds: {
				contents: [
					{
						radius: 60,
					},
					{
						radius: 60,
						updateSource: soundUpdateSource,
					},
				],
			},
		});

		await runPreCreate(scene);

		expect(sceneUpdateSource).toHaveBeenCalled();
		expect(lightUpdateSource).toHaveBeenCalledWith(
			expect.objectContaining({
				'config.dim': 6,
				'config.bright': 3,
			}),
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
});
