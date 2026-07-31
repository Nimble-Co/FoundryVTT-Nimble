import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import AutomationSettingsDialog from '#view/settings/AutomationSettingsDialog.svelte';
import {
	AUTOMATION_SETTING_KEYS,
	LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY,
	resolveLegacyAutoApplyDefault,
} from './automationSettings.js';

const MENU_ICON = 'fa-solid fa-gears';

/** Tracks the open dialog so repeated submenu clicks focus it instead of stacking copies. */
let openEditor: AutomationSettingsMenu | null = null;

/**
 * No-argument ApplicationV2 wrapper so the Svelte dialog can be registered as a
 * Foundry settings submenu, which renders the native title + button + hint row
 * and instantiates the menu via `new type()`.
 */
class AutomationSettingsMenu extends GenericDialog {
	constructor() {
		super(
			game.i18n.localize('NIMBLE.settings.automationMenu.title'),
			AutomationSettingsDialog as unknown as Component<Record<string, never>>,
			{},
			{ uniqueId: 'nimble-automation-settings', icon: MENU_ICON, width: 520, resizable: true },
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

interface StoredWorldSetting {
	key?: string;
}

/**
 * Whether the world database holds an explicit value for the legacy
 * auto-apply-conditions setting. Registration-time reads of `game.settings.get`
 * cannot distinguish a stored `false` from the registered default, so the
 * storage collection is inspected directly.
 */
function legacyAutoApplySettingExistsInStorage(): boolean {
	const storage = game.settings?.storage?.get('world') as
		| { contents?: StoredWorldSetting[] }
		| undefined;
	const legacyKey = `${SYSTEM_ID}.${LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY}`;
	return Boolean(storage?.contents?.some((setting) => setting.key === legacyKey));
}

export function registerAutomationSettings(): void {
	// Legacy setting retained as a hidden registration so existing worlds keep their value.
	game.settings.register(
		SYSTEM_ID as 'core',
		LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.autoApplyConditions.name',
			hint: 'NIMBLE.settings.autoApplyConditions.hint',
			scope: 'world',
			config: false,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	// One-time-in-effect migration via dynamic default: a world that explicitly
	// stored the legacy toggle keeps that behavior for Apply Rule Effects; fresh
	// worlds default to on. No writes occur, so this stays idempotent and
	// resolves identically on every client.
	const applyRuleEffectsDefault = resolveLegacyAutoApplyDefault(
		legacyAutoApplySettingExistsInStorage(),
		Boolean(
			game.settings.get(
				SYSTEM_ID as 'core',
				LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY as 'rollMode',
			),
		),
	);

	const toggleDefaults: Record<string, boolean> = {
		[AUTOMATION_SETTING_KEYS.applyRuleEffects]: applyRuleEffectsDefault,
	};

	for (const [shortKey, settingKey] of Object.entries(AUTOMATION_SETTING_KEYS)) {
		game.settings.register(
			SYSTEM_ID as 'core',
			settingKey as 'rollMode',
			{
				name: `NIMBLE.settings.${shortKey}.name`,
				hint: `NIMBLE.settings.${shortKey}.hint`,
				scope: 'world',
				config: false,
				type: Boolean,
				default: toggleDefaults[settingKey] ?? true,
			} as unknown as Parameters<typeof game.settings.register>[2],
		);
	}

	// GM-only submenu button shown in the system settings tab.
	game.settings.registerMenu(SYSTEM_ID, 'automationMenu', {
		name: 'NIMBLE.settings.automationMenu.name',
		label: 'NIMBLE.settings.automationMenu.manageButton',
		hint: 'NIMBLE.settings.automationMenu.hint',
		icon: MENU_ICON,
		type: AutomationSettingsMenu as unknown as new () => foundry.applications.api.ApplicationV2.Any,
		restricted: true,
	});
}
