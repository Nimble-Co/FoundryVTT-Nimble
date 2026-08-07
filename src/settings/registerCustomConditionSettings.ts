import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import CustomConditionsEditor from '#view/settings/CustomConditionsEditor.svelte';
import {
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
			game.i18n.localize('NIMBLE.settings.customConditions.title'),
			CustomConditionsEditor as unknown as Component<Record<string, never>>,
			{},
			{ uniqueId: 'nimble-custom-conditions', icon: EDITOR_ICON, width: 560, resizable: true },
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

/**
 * Re-render the actor sheets and dialogs that read condition config at render time, so edits
 * appear without a reload. Svelte components capture `CONFIG.NIMBLE` at script init, so
 * re-rendering the host re-instantiates them. Item sheets pick the changes up when reopened.
 */
function rerenderConditionConsumers(): void {
	const shouldRerender = (name: string | undefined): boolean =>
		name === 'PlayerCharacterSheet' || name === 'NPCSheet' || name === 'GenericDialog';

	const v1 = Object.values(ui.windows ?? {}) as Array<{
		render?: (force?: boolean) => void;
		constructor: { name: string };
	}>;
	for (const app of v1) {
		if (shouldRerender(app.constructor?.name)) app.render?.(false);
	}

	const v2 = (foundry.applications?.instances ?? new Map()) as Map<
		string,
		{ render?: (force?: boolean) => void; constructor: { name: string } }
	>;
	v2.forEach((app) => {
		if (shouldRerender(app.constructor?.name)) app.render?.(false);
	});
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
				// so the manager has to rebuild its records and re-publish the snapshot before the
				// token HUD and condition lists can show the change.
				game.nimble.conditions.initialize();
				game.nimble.conditions.configureStatusEffects();
				rerenderConditionConsumers();
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
	// This runs before `ConditionManager.initialize()` during setup, so the manager picks the
	// merged conditions up on its first pass.
	mergeCustomConditionsIntoConfig();
}
