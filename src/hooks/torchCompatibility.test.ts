import { beforeEach, describe, expect, it, vi } from 'vitest';

type TorchCompatibilityTestGlobals = {
	game: {
		modules: {
			get: (id: string) => { active: boolean } | undefined;
		};
		settings: {
			get: ReturnType<typeof vi.fn>;
			set: ReturnType<typeof vi.fn>;
		};
		user: {
			isGM: boolean;
		};
	};
};

function globals() {
	return globalThis as unknown as TorchCompatibilityTestGlobals;
}

describe('registerTorchCompatibility', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.modules = {
			get: vi.fn().mockReturnValue({ active: true }),
		};
		globals().game.settings = {
			get: vi.fn().mockReturnValue(''),
			set: vi.fn(),
		};
		globals().game.user = { isGM: true };
	});

	it('does nothing when the Torch module is not active', async () => {
		globals().game.modules.get = vi.fn().mockReturnValue(undefined);

		const registerTorchCompatibility = (await import('./torchCompatibility.js')).default;
		registerTorchCompatibility();

		expect(globals().game.settings.set).not.toHaveBeenCalled();
	});

	it('does nothing when the Torch module is installed but inactive', async () => {
		globals().game.modules.get = vi.fn().mockReturnValue({ active: false });

		const registerTorchCompatibility = (await import('./torchCompatibility.js')).default;
		registerTorchCompatibility();

		expect(globals().game.settings.set).not.toHaveBeenCalled();
	});

	it('configures gameLightSources when module is active, setting is empty, and user is GM', async () => {
		globals().game.settings.get = vi.fn().mockReturnValue('');

		const registerTorchCompatibility = (await import('./torchCompatibility.js')).default;
		registerTorchCompatibility();

		expect(globals().game.settings.set).toHaveBeenCalledWith(
			'torch',
			'gameLightSources',
			'systems/nimble/torch-nimble.json',
		);
	});

	it('does nothing when gameLightSources is already set by the GM', async () => {
		globals().game.settings.get = vi.fn().mockReturnValue('systems/custom/my-lights.json');

		const registerTorchCompatibility = (await import('./torchCompatibility.js')).default;
		registerTorchCompatibility();

		expect(globals().game.settings.set).not.toHaveBeenCalled();
	});

	it('does nothing when the current user is not the GM', async () => {
		globals().game.user = { isGM: false };

		const registerTorchCompatibility = (await import('./torchCompatibility.js')).default;
		registerTorchCompatibility();

		expect(globals().game.settings.set).not.toHaveBeenCalled();
		expect(globals().game.settings.get).not.toHaveBeenCalled();
	});
});
