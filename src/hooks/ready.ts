import { mount, unmount } from 'svelte';

import { MigrationList } from '../migration/MigrationList.js';
import { MigrationRunner } from '../migration/MigrationRunner.js';
import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import { registerCombatTurnSocketListener } from '../utils/combatTurnActions.js';
import CanvasConditionsPanel from '../view/ui/CanvasConditionsPanel.svelte';
import CtTopTracker from '../view/ui/CtTopTracker.svelte';
import combatStateGuards from './combatStateGuards.js';
import registerMinionGroupTokenActions from './minionGroupTokenActions.js';

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
	registerMinionGroupTokenActions();

	const combatTrackerConfig = game.settings.get('core', 'combatTrackerConfig') ?? {};
	combatTrackerConfig.skipDefeated ??= true;
	game.settings.set('core', 'combatTrackerConfig', combatTrackerConfig);

	// Intercept the combat sidebar button to toggle combat for the scene
	const combatSidebarButton = document.querySelector<HTMLElement>(
		'#sidebar-tabs [data-tab="combat"]',
	);
	if (combatSidebarButton) {
		combatSidebarButton.addEventListener(
			'click',
			async (event) => {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();

				const scene = canvas.scene;
				if (!scene) {
					ui.notifications?.warn('No active scene to create combat for.');
					return;
				}

				// Check if there's already a combat for this scene
				const existingCombat = game.combats?.contents.find(
					(combat) => combat.scene?.id === scene.id,
				);

				if (existingCombat) {
					// If combat hasn't started yet, just delete it
					if ((existingCombat.round ?? 0) === 0) {
						await existingCombat.delete();
						return;
					}

					// If combat has started, show confirmation dialog
					const confirmed = await foundry.applications.api.DialogV2.confirm({
						window: { title: 'End Combat' },
						content: '<p>End this combat encounter?</p>',
						yes: { label: 'End Combat' },
						no: { label: 'Continue Combat' },
						rejectClose: false,
						modal: true,
					});

					if (confirmed === true) {
						await existingCombat.delete();
					}
				} else {
					// Create a new combat for the current scene
					await Combat.create({ scene: scene.id });
				}
			},
			{ capture: true },
		);
	}
}
