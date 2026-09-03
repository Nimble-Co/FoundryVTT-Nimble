import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import CustomSpellSchoolsEditor from '#view/settings/CustomSpellSchoolsEditor.svelte';
import {
	CUSTOM_SPELL_SCHOOLS_SETTING_KEY,
	mergeCustomSpellSchoolsIntoConfig,
} from './spellSchoolSettings.js';

const EDITOR_ICON = 'fa-solid fa-hat-wizard';

const EDITOR_UNIQUE_ID = `${SYSTEM_ID}-custom-spell-schools`;

/**
 * No-argument ApplicationV2 wrapper so the Svelte editor can be registered as a
 * Foundry settings submenu, which renders the native title + button + hint row
 * and instantiates the menu via `new type()`.
 */
class CustomSpellSchoolsMenu extends GenericDialog {
	constructor() {
		super(
			game.i18n.localize('NIMBLE.settings.customSpellSchools.title'),
			CustomSpellSchoolsEditor as unknown as Component<Record<string, never>>,
			{},
			{ uniqueId: EDITOR_UNIQUE_ID, icon: EDITOR_ICON, width: 520, resizable: true },
		);
	}

	/** Focus the open editor rather than stacking a second copy on repeated submenu clicks. */
	override async render(...args: Parameters<GenericDialog['render']>): Promise<this> {
		const openEditor = GenericDialog.getOpen(EDITOR_UNIQUE_ID);
		if (openEditor && openEditor !== this) {
			openEditor.bringToFront();
			return openEditor as this;
		}

		return super.render(...args);
	}
}

export function registerSpellSchoolSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		CUSTOM_SPELL_SCHOOLS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.customSpellSchools.name',
			hint: 'NIMBLE.settings.customSpellSchools.hint',
			scope: 'world',
			config: false,
			type: Array,
			default: [],
			onChange: () => {
				mergeCustomSpellSchoolsIntoConfig();
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	// GM-only submenu button shown in the system settings tab.
	game.settings.registerMenu(SYSTEM_ID, 'customSpellSchoolsMenu', {
		name: 'NIMBLE.settings.customSpellSchools.name',
		label: 'NIMBLE.settings.customSpellSchools.manageButton',
		hint: 'NIMBLE.settings.customSpellSchools.hint',
		icon: EDITOR_ICON,
		type: CustomSpellSchoolsMenu as unknown as new () => foundry.applications.api.ApplicationV2.Any,
		restricted: true,
	});

	// Snapshot built-ins and apply any stored custom schools now that the setting exists.
	mergeCustomSpellSchoolsIntoConfig();
}
