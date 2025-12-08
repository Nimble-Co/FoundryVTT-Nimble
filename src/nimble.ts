import { handleAutomaticConditionApplication } from './hooks/automaticConditions.js';
import { hotbarDrop } from './hooks/hotBarDrop.js';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD.js';

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

Hooks.on('hotbarDrop', hotbarDrop);

// Refresh tokens when combat ends to remove turn indicators
Hooks.on('deleteCombat', () => {
	if (!canvas?.ready || !canvas?.tokens) return;

	// Refresh all tokens on the canvas to clear turn indicators
	for (const token of canvas.tokens.placeables) {
		token.renderFlags.set({ refreshTurnMarker: true });
	}
});
