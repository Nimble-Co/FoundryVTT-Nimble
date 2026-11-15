import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import SupportReportDialog from '#view/settings/SupportReportDialog.svelte';
import localize from '../utils/localize.js';

const WINDOW_ID = 'nimble-support-report';
const ICON = 'fa-solid fa-life-ring';

class SupportReportWindow extends GenericDialog {
	constructor() {
		super(
			localize('NIMBLE.support.window.title'),
			SupportReportDialog as unknown as Component<Record<string, never>>,
			{},
			{ uniqueId: WINDOW_ID, icon: ICON, width: 560, height: 760, resizable: true },
		);
	}
}

/** The settings button. Foundry renders `new type()`, so the menu opens the window instead. */
class SupportReportMenu extends foundry.applications.api.ApplicationV2 {
	override async render(): Promise<this> {
		const open = GenericDialog.getOpen(WINDOW_ID);
		if (open?.rendered) open.bringToFront();
		else void new SupportReportWindow().render(true);
		return this;
	}
}

function registerSupportReportMenu(): void {
	game.settings.registerMenu(
		SYSTEM_ID as 'core',
		'supportReportMenu' as 'rollMode',
		{
			name: 'NIMBLE.support.menu.name',
			label: 'NIMBLE.support.menu.label',
			hint: 'NIMBLE.support.menu.hint',
			icon: ICON,
			type: SupportReportMenu as unknown as new () => foundry.applications.api.ApplicationV2.Any,
			restricted: false,
		} as unknown as Parameters<typeof game.settings.registerMenu>[2],
	);
}

export { registerSupportReportMenu };
