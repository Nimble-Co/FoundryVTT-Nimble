import { handleAutomaticConditionApplication } from './hooks/automaticConditions.js';
import canvasInit from './hooks/canvasInit.js';
import registerCombatantDefeatSync from './hooks/combatantDefeatSync.js';
import registerMinionGroupTokenBadges from './hooks/minionGroupTokenBadges.js';
import { hotbarDrop as onHotbarDrop } from './hooks/hotBarDrop.js';
import i18nInit from './hooks/i18nInit.js';
import init from './hooks/init.js';
import ready from './hooks/ready.js';
import renderChatMessageHTML from './hooks/renderChatMessage.js';
import renderCompendium from './hooks/renderCompendium.js';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD.js';
import setup from './hooks/setup.js';
import './scss/main.scss';
import { getCombatManaGrantForCombat, getCombatManaGrantMap } from './utils/combatManaRules.js';
import { injectViteHmrClient } from './utils/viteHmr.js';

async function clearCombatManaFromCombat(combat: Combat): Promise<void> {
	const combatId = combat.id;
	if (!combatId) return;

	const updates = combat.combatants.reduce<Promise<unknown>[]>((acc, combatant) => {
		const actor = combatant.actor;
		if (!actor || actor.type !== 'character') return acc;
		if (!actor.isOwner) return acc;

		const manaGrant = getCombatManaGrantForCombat(actor, combatId);
		if (manaGrant <= 0) return acc;

		const grants = getCombatManaGrantMap(actor);
		delete grants[combatId];

		acc.push(
			actor.update({
				'system.resources.mana.baseMax': 0,
				'system.resources.mana.current': 0,
				'flags.nimble.combatManaGrants': grants,
			} as Record<string, unknown>),
		);
		return acc;
	}, []);

	if (updates.length > 0) {
		await Promise.all(updates);
	}
}

// Inject Vite HMR client for hot reload support during development
injectViteHmrClient();

/** ----------------------------------- */
//                Hooks
/** ----------------------------------- */
Hooks.once('init', init);
Hooks.once('setup', setup);
Hooks.once('ready', ready);
Hooks.once('i18nInit', i18nInit);

Hooks.on('canvasInit', canvasInit);
Hooks.on('renderChatMessageHTML', renderChatMessageHTML);
Hooks.on('renderCompendium', renderCompendium);

(Hooks.on as (event: string, fn: (...args: object[]) => void) => number)(
	'renderNimbleTokenHUD',
	renderNimbleTokenHUD,
);

type HookFn = (...args: object[]) => undefined | boolean | Promise<undefined | boolean>;
(Hooks.on as (event: string, fn: HookFn) => number)(
	'preCreateActiveEffect',
	handleAutomaticConditionApplication.preCreate as object as HookFn,
);
(Hooks.on as (event: string, fn: HookFn) => number)(
	'preDeleteActiveEffect',
	handleAutomaticConditionApplication.preDelete as object as HookFn,
);
(Hooks.on as (event: string, fn: HookFn) => number)(
	'createActiveEffect',
	handleAutomaticConditionApplication.postCreate as object as HookFn,
);
(Hooks.on as (event: string, fn: HookFn) => number)(
	'deleteActiveEffect',
	handleAutomaticConditionApplication.postDelete as object as HookFn,
);

Hooks.on('hotbarDrop', onHotbarDrop);
registerCombatantDefeatSync();
registerMinionGroupTokenBadges();

// Refresh tokens when combat ends to remove turn indicators
Hooks.on('deleteCombat', async (combat: Combat) => {
	await clearCombatManaFromCombat(combat);

	if (!canvas?.ready || !canvas?.tokens) return;

	// Refresh all tokens on the canvas to clear turn indicators
	for (const token of canvas.tokens.placeables) {
		token.renderFlags.set({ refreshTurnMarker: true });
	}
});

// Also clear temporary combat mana when combat is ended without being deleted.
Hooks.on('updateCombat', async (combat: Combat) => {
	const isEnded = !combat.started || combat.round === 0;
	if (!isEnded) return;

	await clearCombatManaFromCombat(combat);
});

// Accept HMR updates during development
// For FoundryVTT, a full reload is typically safest when JS changes
if (import.meta.hot) {
	import.meta.hot.accept();
}
