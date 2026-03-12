/**
 * Torch module compatibility hook.
 *
 * When the "Torch" module (id: torch) is active and the GM hasn't set a custom
 * light-source file, this hook auto-configures the `gameLightSources` setting
 * to point to the bundled Nimble light-source definitions so that Torch
 * recognises "Torch (Stack of 2)" and "Lantern & Oil" from the system item
 * compendium without any manual GM configuration.
 *
 * Setting `gameLightSources` to an empty string restores Torch's default
 * fallback behaviour; this hook intentionally leaves it alone when it has
 * already been set by the GM.
 */

/**
 * Auto-configure Torch's gameLightSources setting to use Nimble's light
 * source definitions. Only runs when the Torch module is active and the GM has
 * not already provided a custom configuration file.
 */
export default function registerTorchCompatibility(): void {
	if (!game.modules.get('torch')?.active) {
		console.debug('Nimble | Torch module not active; skipping compatibility configuration');
		return;
	}

	if (!game.user?.isGM) {
		console.debug('Nimble | Torch compatibility: skipping (non-GM user)');
		return;
	}

	// Torch settings require unsafe type casts because the module is external
	// and not represented in FoundryVTT's core type definitions.
	const current = game.settings.get('torch' as 'core', 'gameLightSources' as 'rollMode') as string;

	if (current) {
		console.debug('Nimble | Torch gameLightSources already configured by GM; skipping');
		return;
	}

	game.settings.set(
		'torch' as 'core',
		'gameLightSources' as 'rollMode',
		'systems/nimble/torch-nimble.json' as never,
	);
	console.log(
		'Nimble | Torch compatibility: configured gameLightSources to systems/nimble/torch-nimble.json',
	);
}
