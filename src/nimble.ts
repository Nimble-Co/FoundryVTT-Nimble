import { handleAutomaticConditionApplication } from './hooks/automaticConditions.js';
import canvasInit from './hooks/canvasInit.js';
import { hotbarDrop as onHotbarDrop } from './hooks/hotBarDrop.js';
import i18nInit from './hooks/i18nInit.js';
import init from './hooks/init.js';
import ready from './hooks/ready.js';
import renderChatMessageHTML from './hooks/renderChatMessage.js';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD.js';
import setup from './hooks/setup.js';
import './scss/main.scss';
import { injectViteHmrClient } from './utils/viteHmr.js';

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

/** Actor system with mana resources for combat mana clearing */
interface ActorSystemWithCombatMana {
	resources?: {
		mana?: {
			current: number;
			combatMana: number;
		};
	};
}

// Refresh tokens when combat ends to remove turn indicators
// Also clear combat mana for all combatants
Hooks.on('deleteCombat', async (combat: Combat) => {
	if (canvas?.ready && canvas?.tokens) {
		// Refresh all tokens on the canvas to clear turn indicators
		for (const token of canvas.tokens.placeables) {
			token.renderFlags.set({ refreshTurnMarker: true });
		}
	}

	// Clear combat mana for all combatants (GM only)
	if (!game.user?.isGM) return;

	for (const combatant of combat.combatants) {
		if (combatant.type !== 'character') continue;
		const actor = combatant.actor as
			| (Actor.Implementation & { system: ActorSystemWithCombatMana })
			| null;
		if (!actor) continue;

		const combatMana = actor.system.resources?.mana?.combatMana ?? 0;
		if (combatMana > 0) {
			const currentMana = actor.system.resources?.mana?.current ?? 0;
			await actor.update({
				'system.resources.mana.current': Math.max(0, currentMana - combatMana),
				'system.resources.mana.combatMana': 0,
			} as Record<string, unknown>);
		}
	}
});

// Accept HMR updates during development
// For FoundryVTT, a full reload is typically safest when JS changes
if (import.meta.hot) {
	import.meta.hot.accept();
}
