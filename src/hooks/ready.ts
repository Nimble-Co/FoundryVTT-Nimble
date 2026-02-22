import { mount, unmount } from 'svelte';

import { MigrationList } from '../migration/MigrationList.js';
import { MigrationRunner } from '../migration/MigrationRunner.js';
import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import CanvasConditionsPanel from '../view/ui/CanvasConditionsPanel.svelte';
import CombatTracker from '../view/ui/CombatTracker.svelte';
import combatStateGuards from './combatStateGuards.js';

let canvasConditionsPanelComponent: object | null = null;

export default async function ready() {
	// Run migrations if needed
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

	game.nimble.conditions.configureStatusEffects();

	const target = document.body;
	const anchor = document.querySelector('#notifications');

	if (!target || !anchor) return;

	mount(CombatTracker, {
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

	const combatTrackerConfig = game.settings.get('core', 'combatTrackerConfig') ?? {};
	combatTrackerConfig.skipDefeated ??= true;
	game.settings.set('core', 'combatTrackerConfig', combatTrackerConfig);
}
