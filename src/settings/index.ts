const { ApplicationV2 } = foundry.applications.api;
import LanguageSettingsShim from './LanguageSettingsShim.js';
import OptionalRulesSettingsShim from './OptionalRulesSettingsShim.js';
import { settings } from './settings.js';
import UISettingsShim from './UISettingsShim.js';

/**
 * Register all system settings
 */
export default function registerSystemSettings() {
	// Register the system ui settings menu
	game.settings.registerMenu('nimble', 'systemUIMenu', {
		name: 'NIMBLE.settings.uiMenu.name',
		label: 'NIMBLE.settings.uiMenu.label',
		hint: 'Adjust how the Nimble system UI integration, modify token overlays, condition icons, and reaction prompts.',
		icon: 'fa-solid fa-palette',
		type: UISettingsShim,
		restricted: false,
	});
	// Register the in-game languages settings menu
	game.settings.registerMenu('nimble', 'languageMenu', {
		name: 'NIMBLE.settings.languagesMenu.name',
		label: 'NIMBLE.settings.languagesMenu.label',
		hint: 'Manage the set of in-game languages available in your world on character sheets.',
		icon: 'fa-solid fa-language',
		type: LanguageSettingsShim,
		restricted: false,
	});
	// Register the optional rules settings menu button
	game.settings.registerMenu('nimble', 'optionalRulesMenu', {
		name: 'NIMBLE.settings.optionalRulesMenu.name',
		label: 'NIMBLE.settings.optionalRulesMenu.label',
		hint: 'Enable or tweak variant rules such as Gritty Dying, Fast Resting, and Multiclassing to fit your campaign.',
		icon: 'fa-solid fa-list-check',
		type: OptionalRulesSettingsShim,
		restricted: false,
	});

	// Register all settings from the settings array
	for (const setting of settings) {
		// @ts-expect-error - Foundry types don't support custom namespaces
		game.settings.register(setting.namespace, setting.key, setting.options);
	}
}
