import { mount, unmount } from 'svelte';
import {
	beginWorldMigration,
	warnPlayerOfPendingMigration,
} from '../migration/beginWorldMigration.js';
import { runDevFlagRebrandPersist } from '../migration/devFlagRebrand.js';
import {
	getAdjacencySyncEnabled,
	migrateLegacyDiagonalSetting,
} from '../settings/adjacencySettings.js';
import { checkGridDiagonals } from '../settings/gridDiagonalsCheck.js';
import {
	applyLanguageCustomizations,
	loadAncestryLanguageDefaults,
} from '../settings/languageSettings.js';
import { openWorldMigrationWindow } from '../settings/registerWorldMigrationMenu.js';
import { registerMarkTargetSocketListener } from '../utils/actor/markTargetEffects.js';
import { registerCardSocketListener } from '../utils/chat/cardOperations.js';
import { registerCombatTurnSocketListener } from '../utils/combat/combatTurnActions.js';
import { registerGrantedActionOfferSocketListener } from '../utils/combat/grantedActionOffers.js';
import { registerCombatantActionDeltaSocketListener } from '../utils/combat/requestCombatantActionDelta.js';
import { registerPartyStashSocketListener } from '../utils/partyStash/requestItemTransfer.js';
// Their modules define the card operations and notices the socket listener runs.
import '../utils/defend/defendRequests.js';
import '../utils/incomingReactions/incomingAttackReactions.js';
import '../utils/reroll/broadcastRerollRolling.js';
import { registerRerollRollingHook } from '../utils/reroll/rerollRolling.svelte.js';
import CanvasConditionsPanel from '../view/ui/CanvasConditionsPanel.svelte';
import CtTopTracker from '../view/ui/CtTopTracker.svelte';
import registerAdjacencySync from './combatantHooks/adjacencySync.js';
import registerCombatSidebarToggle from './combatSidebarToggle.js';
import combatStateGuards from './combatStateGuards.js';
import registerDicePoolSpendRequestRouter from './dicePoolSpendRequestRouter.js';
import { registerGridDiagonalsCheckHooks } from './gridDiagonalsCheck.js';
import registerMinionGroupTokenActions from './minionGroupTokenActions.js';
import registerMovementOffers from './movementOffers.js';

let canvasConditionsPanelComponent: object | null = null;

export default async function ready() {
	// Only the GM should run migrations (requires world-level write permissions)
	if (game.user?.isGM) {
		// Dev-build-only phase 2: persist the in-memory rebrand (from
		// preInitGame) to the database. No-op on the stable install, on
		// non-GM clients, and on already-clean dev worlds.
		await runDevFlagRebrandPersist();

		await beginWorldMigration(openWorldMigrationWindow);
	} else {
		warnPlayerOfPendingMigration();
	}

	game.nimble.conditions.configureStatusEffects();
	await loadAncestryLanguageDefaults();
	applyLanguageCustomizations();
	// Actors were prepared during world init before language grants became managed,
	// so re-prepare characters once so any GM language overrides take effect.
	// `reset()`, not `prepareData()`: the latter would re-run every rule hook over
	// the already-derived `system` object and stack read-modify-write bonuses twice.
	for (const actor of game.actors ?? []) {
		if (actor?.type === 'character') actor.reset?.();
	}
	registerCombatTurnSocketListener();
	registerGrantedActionOfferSocketListener();
	registerMovementOffers();
	registerCardSocketListener();
	registerRerollRollingHook();
	registerMarkTargetSocketListener();
	registerCombatantActionDeltaSocketListener();
	registerPartyStashSocketListener();

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
	migrateLegacyDiagonalSetting()
		.then(() => checkGridDiagonals())
		.catch((error) => console.error(error));
	registerGridDiagonalsCheckHooks();
	registerMinionGroupTokenActions();
	registerDicePoolSpendRequestRouter();

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
