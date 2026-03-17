import { mount, unmount } from 'svelte';

import { MigrationList } from '../migration/MigrationList.js';
import { MigrationRunner } from '../migration/MigrationRunner.js';
import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import { registerCombatTurnSocketListener } from '../utils/combatTurnActions.js';
import localize from '../utils/localize.js';
import CanvasConditionsPanel from '../view/ui/CanvasConditionsPanel.svelte';
import CtTopTracker from '../view/ui/CtTopTracker.svelte';
import combatStateGuards from './combatStateGuards.js';
import registerMinionGroupTokenActions from './minionGroupTokenActions.js';

function canUserToggleCombat(): boolean {
	const user = game.user;
	if (!user) return false;
	if (user.isGM) return true;
	const assistantRoleValue = Number(CONST.USER_ROLES?.ASSISTANT ?? 3);
	return (user.role ?? 0) >= assistantRoleValue;
}

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

	// Enable combat toggle visibility for GM/Assistant users via CSS
	if (canUserToggleCombat()) {
		document.body.classList.add('nimble-combat-toggle-enabled');
	}

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
					const hasCombatants = existingCombat.combatants.size > 0;
					const hasStarted = (existingCombat.round ?? 0) > 0;

					// Confirm before ending combat if there are combatants or combat has started
					if (hasCombatants || hasStarted) {
						const confirmed = await foundry.applications.api.DialogV2.confirm({
							window: { title: localize('NIMBLE.combatControls.endCombatTitle') },
							content: `<p>${localize('NIMBLE.combatControls.endCombatContent')}</p>`,
							yes: { label: localize('NIMBLE.combatControls.endCombat') },
							no: { label: localize('NIMBLE.combatControls.continueCombat') },
							rejectClose: false,
							modal: true,
						});

						if (confirmed === true) {
							await existingCombat.delete();
						}
					} else {
						// No combatants and not started, delete without confirmation
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
