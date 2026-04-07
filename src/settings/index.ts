import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import DiceTestbench from '#view/debug/DiceTestbench.svelte';
import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import { registerCombatTrackerSettings } from './combatTrackerSettings.js';
import { AUTO_ADD_CHARACTER_TO_COMBAT_ON_INITIATIVE_ROLL_SETTING_KEY } from './initiativeSettings.js';
import { registerNcswSettings } from './ncswSettings.js';

export const DEBUG_MODE_SETTING_KEY = 'debugMode';

function rerenderSettingsConfigIfOpen(): void {
	const apps = Object.values(ui.windows ?? {}) as Array<{
		rerender?: () => void;
		render?: (force?: boolean) => void;
		constructor: { name: string };
	}>;
	for (const app of apps) {
		if (app.constructor?.name === 'SettingsConfig') {
			app.render?.(false);
		}
	}
	const v2 = (foundry.applications?.instances ?? new Map()) as Map<
		string,
		{ constructor: { name: string }; render?: (force?: boolean) => void }
	>;
	v2.forEach((app) => {
		if (app.constructor?.name === 'SettingsConfig') {
			app.render?.(false);
		}
	});
}

export function isDebugModeEnabled(): boolean {
	const settings = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	if (!settings?.has(`nimble.${DEBUG_MODE_SETTING_KEY}`)) return false;
	return Boolean(game.settings.get('nimble' as 'core', DEBUG_MODE_SETTING_KEY as 'rollMode'));
}

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

	game.settings.register(
		'nimble' as 'core',
		AUTO_ADD_CHARACTER_TO_COMBAT_ON_INITIATIVE_ROLL_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.autoAddCharacterToCombatOnInitiativeRoll.name',
			hint: 'NIMBLE.settings.autoAddCharacterToCombatOnInitiativeRoll.hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	registerCombatTrackerSettings();
	registerNcswSettings();

	game.settings.register(
		'nimble' as 'core',
		DEBUG_MODE_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.debugMode.name',
			hint: 'NIMBLE.settings.debugMode.hint',
			scope: 'client',
			config: true,
			type: Boolean,
			default: false,
			onChange: () => {
				rerenderSettingsConfigIfOpen();
			},
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

	Hooks.on('renderSettingsConfig', (_app: unknown, html: HTMLElement | JQuery) => {
		const element = html instanceof HTMLElement ? html : html[0];
		if (!element) return;
		if (!isDebugModeEnabled()) return;
		if (element.querySelector('.nimble-dice-testbench-launch')) return;

		const checkbox =
			element.querySelector<HTMLInputElement>('input[name="nimble.debugMode"]') ??
			element.querySelector<HTMLInputElement>('[name="nimble.debugMode"]');
		if (!checkbox) return;

		const formGroup = checkbox.closest('.form-group') ?? checkbox.closest('div');
		if (!formGroup || !formGroup.parentElement) return;

		const wrapper = document.createElement('div');
		wrapper.className = 'form-group nimble-dice-testbench-launch';
		const label = document.createElement('label');
		label.textContent = '';
		const fields = document.createElement('div');
		fields.className = 'form-fields';
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = game.i18n.localize('NIMBLE.settings.debugMode.openTestbench');
		button.addEventListener('click', (ev) => {
			ev.preventDefault();
			const dialog = GenericDialog.getOrCreate(
				game.i18n.localize('NIMBLE.diceTestbench.title'),
				DiceTestbench as unknown as Component<Record<string, never>>,
				{},
				{
					uniqueId: 'nimble-dice-testbench',
					icon: 'fa-solid fa-dice-d20',
					width: 900,
					resizable: true,
				},
			);
			dialog.render(true);
		});
		fields.appendChild(button);
		wrapper.appendChild(label);
		wrapper.appendChild(fields);

		formGroup.parentElement.insertBefore(wrapper, formGroup.nextSibling);
	});
}
