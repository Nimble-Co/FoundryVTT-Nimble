import { handleAutomaticConditionApplication } from './hooks/automaticConditions.js';
import canvasInit from './hooks/canvasInit.js';
import registerCombatantDefeatSync from './hooks/combatantDefeatSync.js';
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
registerCombatantDefeatSync();

// Refresh tokens when combat ends to remove turn indicators
Hooks.on('deleteCombat', () => {
	if (!canvas?.ready || !canvas?.tokens) return;

	// Refresh all tokens on the canvas to clear turn indicators
	for (const token of canvas.tokens.placeables) {
		token.renderFlags.set({ refreshTurnMarker: true });
	}
});

// Accept HMR updates during development
// For FoundryVTT, a full reload is typically safest when JS changes
if (import.meta.hot) {
	import.meta.hot.accept();
}
