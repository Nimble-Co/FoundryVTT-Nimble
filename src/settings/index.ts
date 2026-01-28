import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
const { ApplicationV2 } = foundry.applications.api;

const namespace = 'nimble';
export const settings = [
	{
		namespace,
		key: 'hideRolls',
		options: {
			name: 'nimble.settings.dice.hideRolls',
			hint: 'nimble.settings.hints.hideRolls',
			scope: 'client',
			config: false,
			default: false,
			type: Boolean,
		},
	},
];

export default function registerSystemSettings() {
	game.settings.register(
		'nimble' as 'core',
		'autoExpandRolls' as 'rollMode',
		{
			name: 'NIMBLE.settings.autoExpandRolls.name',
			hint: 'NIMBLE.settings.autoExpandRolls.hint',
			scope: 'client',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	for (const setting of settings) {
		game.settings.register(
			setting.namespace as 'core',
			setting.key as 'rollMode',
			setting.options as unknown as Parameters<typeof game.settings.register>[2],
		);
	}

	game.settings.register(
		'nimble' as 'core',
		'hideRolls' as 'rollMode',
		{
			name: 'Hide Rolls by Default',
			hint: 'When enabled, skill check and weapon roll dialogs will default to hiding the roll from other players.',
			scope: 'client',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	// Migration schema version tracking
	// Migration schema version tracking (internal, not visible)
	game.settings.register(
		'nimble' as 'core',
		'worldSchemaVersion' as 'rollMode',
		{
			name: 'World Schema Version',
			hint: 'Tracks the current migration version of this world',
			scope: 'world',
			config: false,
			type: Number,
			default: MigrationRunnerBase.MINIMUM_SAFE_VERSION,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	// Helper to create the attribution element with divider
	const createAttributionElement = () => {
		const wrapper = document.createElement('div');
		wrapper.className = 'nimble-attribution-wrapper';
		wrapper.innerHTML = `
			<hr class="nimble-attribution__divider">
			<section class="nimble-attribution">
				<div class="nimble-attribution__icon">
					<i class="fa-solid fa-heart"></i>
				</div>
				<div class="nimble-attribution__content">
					<p class="nimble-attribution__text">
						The Nimble system for Foundry VTT is free for anyone who already owns the content,
						is trying the system out, or cannot afford to purchase it right now. If you enjoy
						Nimble and are able, please consider supporting the game by purchasing the official content.
					</p>
					<a href="https://nimblerpg.com" target="_blank" rel="noopener noreferrer" class="nimble-attribution__link">
						<i class="fa-solid fa-external-link"></i>
						nimblerpg.com
					</a>
				</div>
			</section>
		`;
		return wrapper;
	};

	// Add attribution to the Configure Settings dialog (Nimble tab)
	Hooks.on('renderSettingsConfig', (_app: unknown, html: HTMLElement | JQuery) => {
		const element = html instanceof HTMLElement ? html : html[0];
		if (!element) return;

		// Find the system settings tab (where Nimble settings appear)
		const systemTab =
			element.querySelector('section[data-tab="system"]') ||
			element.querySelector('section[data-category="system"]');
		if (!systemTab) return;

		// Check if attribution already exists (e.g. re-render)
		if (systemTab.querySelector('.nimble-attribution')) return;

		// Dynamically append attribution at the end of the system settings tab
		systemTab.appendChild(createAttributionElement());
	});
}
