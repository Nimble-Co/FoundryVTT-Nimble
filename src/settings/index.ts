import localize from '#utils/localize.ts';
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

	const createBranchBadge = () => {
		const badge = document.createElement('div');
		badge.className = 'nimble-branch-badge';

		const icon = document.createElement('i');
		icon.className = 'fa-solid fa-code-branch nimble-branch-badge__icon';

		const label = document.createElement('span');
		label.className = 'nimble-branch-badge__label';
		label.textContent = localize('NIMBLE.settings.branchBadge.label');

		const name = document.createElement('code');
		name.className = 'nimble-branch-badge__name';
		name.textContent = __BRANCH__;

		badge.append(icon, label, name);
		return badge;
	};

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

		const hasBranchBadge = !!systemTab.querySelector('.nimble-branch-badge');
		const hasAttribution = !!systemTab.querySelector('.nimble-attribution');

		if (hasBranchBadge && hasAttribution) return;

		const isMeaningfulBranch =
			__BRANCH__ !== 'unknown' && __BRANCH__ !== 'HEAD' && __BRANCH__.trim() !== '';
		if (!hasBranchBadge && isMeaningfulBranch) {
			systemTab.prepend(createBranchBadge());
		}

		if (!hasAttribution) {
			systemTab.appendChild(createAttributionElement());
		}
	});
}
