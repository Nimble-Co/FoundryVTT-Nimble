import { mount, unmount } from 'svelte';

import { MigrationList } from '../migration/MigrationList.js';
import { MigrationRunner } from '../migration/MigrationRunner.js';
import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import { registerCombatTurnSocketListener } from '../utils/combatTurnActions.js';
import CanvasConditionsPanel from '../view/ui/CanvasConditionsPanel.svelte';
import CtTopTracker from '../view/ui/CtTopTracker.svelte';
import registerLionheartedAdjacencySync from './combatantHooks/lionheartedAdjacencySync.js';
import registerCombatSidebarToggle from './combatSidebarToggle.js';
import combatStateGuards from './combatStateGuards.js';
import registerMinionGroupTokenActions from './minionGroupTokenActions.js';

let canvasConditionsPanelComponent: object | null = null;

export default async function ready() {
	// Only the GM should run migrations (requires world-level write permissions)
	if (game.user?.isGM) {
		const worldSchemaVersion = game.settings.get(
			'nimble' as 'core',
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
	registerLionheartedAdjacencySync();
	registerMinionGroupTokenActions();

	const combatTrackerConfig = game.settings.get('core', 'combatTrackerConfig') ?? {};
	combatTrackerConfig.skipDefeated ??= true;
	game.settings.set('core', 'combatTrackerConfig', combatTrackerConfig);

	registerCombatSidebarToggle();
}
