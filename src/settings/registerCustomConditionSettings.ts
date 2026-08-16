import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import localize from '#utils/localize.js';
import CustomConditionsEditor from '#view/settings/CustomConditionsEditor.svelte';
import {
	CONDITIONS_CHANGED_HOOK,
	CUSTOM_CONDITIONS_SETTING_KEY,
	mergeCustomConditionsIntoConfig,
} from './customConditionSettings.js';

const EDITOR_ICON = 'fa-solid fa-biohazard';

/** Tracks the open editor so repeated submenu clicks focus it instead of stacking copies. */
let openEditor: CustomConditionsMenu | null = null;

/**
 * No-argument ApplicationV2 wrapper so the Svelte editor can be registered as a
 * Foundry settings submenu, which renders the native title + button + hint row
 * and instantiates the menu via `new type()`.
 */
class CustomConditionsMenu extends GenericDialog {
	constructor() {
		super(
			localize('NIMBLE.settings.customConditions.title'),
			CustomConditionsEditor as unknown as Component<Record<string, never>>,
			{},
			{
				uniqueId: `${SYSTEM_ID}-custom-conditions`,
				icon: EDITOR_ICON,
				width: 560,
				resizable: true,
			},
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

export function registerCustomConditionSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		CUSTOM_CONDITIONS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.customConditions.name',
			hint: 'NIMBLE.settings.customConditions.hint',
			scope: 'world',
			config: false,
			type: Array,
			default: [],
			onChange: () => {
				mergeCustomConditionsIntoConfig();
				// `CONFIG.statusEffects` is a snapshot taken at ready, not a live view of the config,
				// so the manager has to rebuild its records and re-publish the snapshot. The token
				// HUD reads that snapshot each time it opens, so it reflects edits immediately.
				game.nimble.conditions.initialize();
				game.nimble.conditions.configureStatusEffects();
				// Condition lists derive from CONFIG, which is not reactive; the hook is what tells
				// an already-rendered list to re-derive. Rule dropdowns still read their choices when
				// their sheet renders, so those pick the change up on reopen.
				// @ts-expect-error - conditionsChanged is a custom system hook
				Hooks.callAll(CONDITIONS_CHANGED_HOOK);
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	// GM-only submenu button shown in the system settings tab.
	game.settings.registerMenu(SYSTEM_ID, 'customConditionsMenu', {
		name: 'NIMBLE.settings.customConditions.name',
		label: 'NIMBLE.settings.customConditions.manageButton',
		hint: 'NIMBLE.settings.customConditions.hint',
		icon: EDITOR_ICON,
		type: CustomConditionsMenu as unknown as new () => foundry.applications.api.ApplicationV2.Any,
		restricted: true,
	});

	// Snapshot built-ins and apply any stored custom conditions now that the setting exists.
	// This runs before documents are initialized and before `ConditionManager.initialize()` during
	// setup, so both rule validation and the manager see the merged conditions on their first pass.
	mergeCustomConditionsIntoConfig();
}
