import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import DiceSoNiceSettingsDialog from '#view/settings/DiceSoNiceSettingsDialog.svelte';
import {
	DEFAULT_PRIMARY_DIE_COLOR,
	DEFAULT_PRIMARY_DIE_LABEL_COLOR,
	DSN_PRIMARY_DIE_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY,
	DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY,
	isDiceSoNiceActive,
} from './diceSoNiceSettings.js';

const MENU_ICON = 'fa-solid fa-dice-d20';
const MENU_KEY = 'diceSoNiceMenu';

/** Tracks the open dialog so repeated submenu clicks focus it instead of stacking copies. */
let openEditor: DiceSoNiceSettingsMenu | null = null;

/**
 * No-argument ApplicationV2 wrapper so the Svelte dialog can be registered as a
 * Foundry settings submenu, which renders the native title + button + hint row
 * and instantiates the menu via `new type()`.
 */
class DiceSoNiceSettingsMenu extends GenericDialog {
	constructor() {
		super(
			game.i18n.localize('NIMBLE.settings.diceSoNiceMenu.title'),
			DiceSoNiceSettingsDialog as unknown as Component<Record<string, never>>,
			{},
			{ uniqueId: 'nimble-dice-so-nice-settings', icon: MENU_ICON, width: 460, resizable: true },
		);
	}

	override async render(...args: Parameters<GenericDialog['render']>): Promise<this> {
		if (openEditor?.rendered && openEditor !== this) {
			openEditor.bringToFront();
			return openEditor as this;
		}
		openEditor = this;
		return super.render(...args);
	}
}

function colorSettingField(initial: string) {
	return new foundry.data.fields.ColorField({ nullable: false, initial });
}

/**
 * Disables the submenu button while Dice So Nice is absent and replaces the
 * row's hint with an explanation, so the settings tab says why the button
 * cannot be used instead of opening a dialog that controls nothing.
 */
function registerModuleAvailabilityNotice(): void {
	Hooks.on('renderSettingsConfig', (_app: unknown, html: HTMLElement | JQuery) => {
		if (isDiceSoNiceActive()) return;

		const element = html instanceof HTMLElement ? html : html[0];
		const button = element?.querySelector<HTMLButtonElement>(
			`button[data-key="${SYSTEM_ID}.${MENU_KEY}"]`,
		);
		if (!button) return;

		button.disabled = true;
		button.dataset.tooltip = game.i18n.localize('NIMBLE.settings.diceSoNiceMenu.moduleMissing');

		const hint = button.closest('.form-group')?.querySelector('.hint');
		if (hint) hint.textContent = game.i18n.localize('NIMBLE.settings.diceSoNiceMenu.moduleMissing');
	});
}

export function registerDiceSoNiceSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.dsnPrimaryDieStyleEnabled.name',
			hint: 'NIMBLE.settings.dsnPrimaryDieStyleEnabled.hint',
			scope: 'user',
			config: false,
			type: Boolean,
			default: true,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	game.settings.register(
		SYSTEM_ID as 'core',
		DSN_PRIMARY_DIE_COLOR_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.dsnPrimaryDieColor.name',
			hint: 'NIMBLE.settings.dsnPrimaryDieColor.hint',
			scope: 'user',
			config: false,
			type: colorSettingField(DEFAULT_PRIMARY_DIE_COLOR),
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	game.settings.register(
		SYSTEM_ID as 'core',
		DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.dsnPrimaryDieLabelColor.name',
			hint: 'NIMBLE.settings.dsnPrimaryDieLabelColor.hint',
			scope: 'user',
			config: false,
			type: colorSettingField(DEFAULT_PRIMARY_DIE_LABEL_COLOR),
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	// Not restricted: the settings behind this menu are per-user, so every
	// player needs the button.
	game.settings.registerMenu(SYSTEM_ID, MENU_KEY, {
		name: 'NIMBLE.settings.diceSoNiceMenu.name',
		label: 'NIMBLE.settings.diceSoNiceMenu.manageButton',
		hint: 'NIMBLE.settings.diceSoNiceMenu.hint',
		icon: MENU_ICON,
		type: DiceSoNiceSettingsMenu as unknown as new () => foundry.applications.api.ApplicationV2.Any,
		restricted: false,
	});

	registerModuleAvailabilityNotice();
}
