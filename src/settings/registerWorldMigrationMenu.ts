import type { DeepPartial } from 'fvtt-types/utils';
import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import WorldMigrationDialog from '#view/settings/WorldMigrationDialog.svelte';
import {
	prepareWorldMigration,
	registerMigrationSettings,
	type WorldMigration,
} from '../migration/worldMigration.svelte.js';

const WINDOW_ID = 'nimble-world-migration';
const ICON = 'fa-solid fa-boxes-packing';

/** The World Migration window. It cannot close while the migration writes. */
class WorldMigrationWindow extends GenericDialog {
	constructor(readonly migration: WorldMigration) {
		super(
			game.i18n.localize('NIMBLE.migration.window.title'),
			WorldMigrationDialog as unknown as Component<Record<string, never>>,
			{ migration },
			{ uniqueId: WINDOW_ID, icon: ICON, width: 480, resizable: true },
		);
	}

	override close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		if (this.migration.phase === 'running') return Promise.resolve(this);
		return super.close(options);
	}
}

function openWorldMigrationWindow(migration: WorldMigration): void {
	const open = GenericDialog.getOpen(WINDOW_ID);
	if (open?.rendered) {
		open.bringToFront();
		return;
	}
	void new WorldMigrationWindow(migration).render(true);
}

/**
 * The settings button. Foundry renders `new type()`, so the menu plans the migration and opens
 * the window instead of rendering itself.
 */
class WorldMigrationMenu extends foundry.applications.api.ApplicationV2 {
	override async render(): Promise<this> {
		const open = GenericDialog.getOpen(WINDOW_ID);
		if (open?.rendered) open.bringToFront();
		else openWorldMigrationWindow(await prepareWorldMigration());
		return this;
	}
}

function registerWorldMigrationMenu(): void {
	registerMigrationSettings();
	game.settings.registerMenu(
		SYSTEM_ID as 'core',
		'worldMigrationMenu' as 'rollMode',
		{
			name: 'NIMBLE.migration.menu.name',
			label: 'NIMBLE.migration.menu.label',
			hint: 'NIMBLE.migration.menu.hint',
			icon: ICON,
			type: WorldMigrationMenu as unknown as new () => foundry.applications.api.ApplicationV2.Any,
			restricted: true,
		} as unknown as Parameters<typeof game.settings.registerMenu>[2],
	);
}

export { openWorldMigrationWindow, registerWorldMigrationMenu };
