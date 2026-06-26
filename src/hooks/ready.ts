import { mount, unmount } from 'svelte';
import { SYSTEM_ID } from '#system';
import { runDevFlagRebrandPersist } from '../migration/devFlagRebrand.js';
import { MigrationList } from '../migration/MigrationList.js';
import { MigrationRunner } from '../migration/MigrationRunner.js';
import { MigrationRunnerBase } from '../migration/MigrationRunnerBase.js';
import { getAdjacencySyncEnabled } from '../settings/adjacencySettings.js';
import { applyLanguageCustomizations } from '../settings/languageSettings.js';
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
	applyLanguageCustomizations();
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

	// Seed Foundry's Default Token Configuration so newly created tokens are usable
	// without per-token setup:
	//  - sight enabled — Nimble has no darkvision, so range stays 0 and the token
	//    sees illuminated areas.
	//  - HP on bar 1.
	//  - Mana on bar 2 — `resources.mana` exists only on characters, so monsters and
	//    NPCs resolve no attribute and draw no second bar ("mana bar only if they
	//    have it").
	//  - Bars shown on owner hover, otherwise the bar mappings would be invisible.
	// `??=` only fills unset values, so a GM who has deliberately configured token
	// defaults is never overridden. World-scoped, so only the GM may write it.
	if (game.user?.isGM) {
		const defaultToken = (game.settings.get('core', 'defaultToken') ?? {}) as {
			sight?: { enabled?: boolean };
			bar1?: { attribute?: string | null };
			bar2?: { attribute?: string | null };
			displayBars?: number;
		};
		defaultToken.sight ??= {};
		defaultToken.sight.enabled ??= true;
		defaultToken.bar1 ??= {};
		defaultToken.bar1.attribute ??= 'attributes.hp';
		defaultToken.bar2 ??= {};
		defaultToken.bar2.attribute ??= 'resources.mana';
		defaultToken.displayBars ??= CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER;
		game.settings.set('core', 'defaultToken', defaultToken);
	}

	registerCombatSidebarToggle();
}
