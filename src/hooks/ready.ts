import { mount, unmount } from 'svelte';
import { SYSTEM_ID } from '#system';
import { runDevFlagRebrandPersist } from '../migration/devFlagRebrand.js';
import { MigrationList } from '../migration/MigrationList.js';
import { MigrationRunner } from '../migration/MigrationRunner.js';
import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import { getAdjacencySyncEnabled } from '../settings/adjacencySettings.js';
import {
	applyLanguageCustomizations,
	loadAncestryLanguageDefaults,
} from '../settings/languageSettings.js';
import { registerCombatTurnSocketListener } from '../utils/combatTurnActions.js';
import CanvasConditionsPanel from '../view/ui/CanvasConditionsPanel.svelte';
import CtTopTracker from '../view/ui/CtTopTracker.svelte';
import registerAdjacencySync from './combatantHooks/adjacencySync.js';
import registerCombatSidebarToggle from './combatSidebarToggle.js';
import combatStateGuards from './combatStateGuards.js';
import registerMinionGroupTokenActions from './minionGroupTokenActions.js';

let canvasConditionsPanelComponent: object | null = null;

export default async function ready() {
	// Only the GM should run migrations (requires world-level write permissions)
	if (game.user?.isGM) {
		// Dev-build-only phase 2: persist the in-memory rebrand (from
		// preInitGame) to the database. No-op on the stable install, on
		// non-GM clients, and on already-clean dev worlds.
		await runDevFlagRebrandPersist();

		const worldSchemaVersion = game.settings.get(
			SYSTEM_ID as 'core',
			'worldSchemaVersion' as 'rollMode',
		) as unknown as number;
		const latestSchemaVersion = MigrationRunnerBase.LATEST_SCHEMA_VERSION;

		if (worldSchemaVersion < latestSchemaVersion) {
			console.log(
				`Nimble | Migration needed: world schema version ${worldSchemaVersion} < latest schema version ${latestSchemaVersion}`,
			);
			const migrations = MigrationList.constructFromVersion(worldSchemaVersion);
			const runner = new MigrationRunner(migrations);
			await runner.runMigration();
		} else {
			console.log(
				`Nimble | No migration needed: world schema version ${worldSchemaVersion} is up to date`,
			);
		}
	}

	game.nimble.conditions.configureStatusEffects();
	await loadAncestryLanguageDefaults();
	applyLanguageCustomizations();
	// Actors were prepared during world init before language grants became managed,
	// so re-prepare characters once so any GM language overrides take effect.
	for (const actor of game.actors ?? []) {
		if (actor?.type === 'character') actor.prepareData?.();
	}
	registerCombatTurnSocketListener();

	const target = document.body;
	const anchor = document.querySelector('#notifications');

	if (!target || !anchor) return;

	// Mount the top Combat Tracker.
	mount(CtTopTracker, {
		anchor,
		target,
	});

	const canvasPanelTarget = document.querySelector('#interface') ?? document.body;
	if (canvasPanelTarget) {
		if (canvasConditionsPanelComponent) {
			unmount(canvasConditionsPanelComponent);
			canvasConditionsPanelComponent = null;
		}

		canvasConditionsPanelComponent = mount(CanvasConditionsPanel, {
			target: canvasPanelTarget,
		});
	}

	combatStateGuards();
	if (getAdjacencySyncEnabled()) registerAdjacencySync();
	registerMinionGroupTokenActions();

	const combatTrackerConfig = game.settings.get('core', 'combatTrackerConfig') ?? {};
	combatTrackerConfig.skipDefeated ??= true;
	game.settings.set('core', 'combatTrackerConfig', combatTrackerConfig);

	// V14 removed the world-level Default Token Configuration (`core.defaultToken`).
	// Its former responsibilities are now covered elsewhere:
	//  - HP on bar 1 / mana on bar 2: `primaryTokenAttribute` / `secondaryTokenAttribute`
	//    in system.json seed the prototype token schema defaults.
	//  - sight + displayBars: seeded per actor subtype in `_preCreate`
	//    (character.ts and monsterPrototypeTokenDefaults.ts).

	registerCombatSidebarToggle();
}
