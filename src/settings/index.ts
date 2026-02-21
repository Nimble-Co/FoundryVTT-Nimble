import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import { registerCombatTrackerSettings } from './combatTrackerSettings.js';

export const settings = [];

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

	game.settings.register(
		'nimble' as 'core',
		'hideRolls' as 'rollMode',
		{
			name: 'NIMBLE.hints.hideRollsFromPlayersByDefault',
			hint: 'NIMBLE.hints.hideRollsFromPlayersByDefaultHint',
			scope: 'client',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	registerCombatTrackerSettings();

	game.settings.register(
		'nimble' as 'core',
		'allowMinionGroupingOutsideCombat' as 'rollMode',
		{
			name: 'Allow Minion Grouping Outside Combat',
			hint: 'When enabled, selected minion tokens can be grouped even if not already in combat. Nimble will add them to scene combat automatically when grouping actions are used.',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

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

	Hooks.on('renderSettingsConfig', (_app: unknown, html: HTMLElement | JQuery) => {
		const element = html instanceof HTMLElement ? html : html[0];
		if (!element) return;

		const systemTab =
			element.querySelector('section[data-tab="system"]') ||
			element.querySelector('section[data-category="system"]');
		if (!systemTab) return;

		if (systemTab.querySelector('.nimble-attribution')) return;

		systemTab.appendChild(createAttributionElement());
	});
}
