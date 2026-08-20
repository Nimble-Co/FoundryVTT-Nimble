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

const EDITOR_UNIQUE_ID = `${SYSTEM_ID}-custom-conditions`;

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
				uniqueId: EDITOR_UNIQUE_ID,
				icon: EDITOR_ICON,
				width: 560,
				resizable: true,
			},
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
				// This runs inside Setting#_onUpdate, so a throw here surfaces as an unrelated
				// document-update failure. Contain it, and announce the change either way: a partly
				// rebuilt config is still worth re-deriving from, and a silently stale panel is worse.
				try {
					mergeCustomConditionsIntoConfig();
					// `CONFIG.statusEffects` is a snapshot, not a live view of the config, so the manager
					// has to rebuild its records and republish it.
					game.nimble?.conditions?.initialize();
					game.nimble?.conditions?.configureStatusEffects();
				} catch (error) {
					console.error('Nimble | Failed to apply the custom conditions:', error);
				} finally {
					// CONFIG is not reactive, so an already-rendered condition list only re-derives if
					// the rebuild is announced.
					// @ts-expect-error - conditionsChanged is a custom system hook
					Hooks.callAll(CONDITIONS_CHANGED_HOOK);
				}
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	game.settings.registerMenu(SYSTEM_ID, 'customConditionsMenu', {
		name: 'NIMBLE.settings.customConditions.name',
		label: 'NIMBLE.settings.customConditions.manageButton',
		hint: 'NIMBLE.settings.customConditions.hint',
		icon: EDITOR_ICON,
		type: CustomConditionsMenu as unknown as new () => foundry.applications.api.ApplicationV2.Any,
		restricted: true,
	});

	// The setting exists now, so snapshot the built-ins and apply anything already stored. See the
	// registration site in `nimble.ts` for why this cannot wait until `setup`.
	mergeCustomConditionsIntoConfig();
}
