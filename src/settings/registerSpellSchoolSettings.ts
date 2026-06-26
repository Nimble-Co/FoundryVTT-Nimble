import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import CustomSpellSchoolsEditor from '#view/settings/CustomSpellSchoolsEditor.svelte';
import {
	CUSTOM_SPELL_SCHOOLS_SETTING_KEY,
	mergeCustomSpellSchoolsIntoConfig,
} from './spellSchoolSettings.js';

/** Open (or focus) the GM-only editor for managing custom spell schools. */
function openCustomSpellSchoolsEditor(): void {
	const dialog = GenericDialog.getOrCreate(
		game.i18n.localize('NIMBLE.settings.customSpellSchools.title'),
		CustomSpellSchoolsEditor as unknown as Component<Record<string, never>>,
		{},
		{
			uniqueId: 'nimble-custom-spell-schools',
			icon: 'fa-solid fa-hat-wizard',
			width: 520,
			resizable: true,
		},
	);
	dialog.render(true);
}

function injectEditorLaunchButton(element: HTMLElement): void {
	if (!game.user?.isGM) return;

	const systemTab =
		element.querySelector('section[data-tab="system"]') ||
		element.querySelector('section[data-category="system"]');
	if (!systemTab) return;
	if (systemTab.querySelector('.nimble-custom-spell-schools-launch')) return;

	const wrapper = document.createElement('div');
	wrapper.className = 'form-group nimble-custom-spell-schools-launch';

	const label = document.createElement('label');
	label.textContent = game.i18n.localize('NIMBLE.settings.customSpellSchools.name');

	const fields = document.createElement('div');
	fields.className = 'form-fields';

	const button = document.createElement('button');
	button.type = 'button';
	button.innerHTML = `<i class="fa-solid fa-hat-wizard"></i> ${game.i18n.localize(
		'NIMBLE.settings.customSpellSchools.manageButton',
	)}`;
	button.addEventListener('click', (event) => {
		event.preventDefault();
		openCustomSpellSchoolsEditor();
	});

	const hint = document.createElement('p');
	hint.className = 'notes';
	hint.textContent = game.i18n.localize('NIMBLE.settings.customSpellSchools.hint');

	fields.appendChild(button);
	wrapper.appendChild(label);
	wrapper.appendChild(fields);
	wrapper.appendChild(hint);

	systemTab.appendChild(wrapper);
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

	// Snapshot built-ins and apply any stored custom schools now that the setting exists.
	mergeCustomSpellSchoolsIntoConfig();

	Hooks.on('renderSettingsConfig', (_app: unknown, html: HTMLElement | JQuery) => {
		const element = html instanceof HTMLElement ? html : html[0];
		if (!element) return;
		injectEditorLaunchButton(element);
	});
}
