import { handleAutomaticConditionApplication } from './hooks/automaticConditions.js';
import canvasInit from './hooks/canvasInit.js';
import registerCombatantDefeatSync from './hooks/combatantDefeatSync.js';
import { hotbarDrop as onHotbarDrop } from './hooks/hotBarDrop.js';
import i18nInit from './hooks/i18nInit.js';
import init from './hooks/init.js';
import ready from './hooks/ready.js';
import renderChatMessageHTML from './hooks/renderChatMessage.js';
import renderCompendium from './hooks/renderCompendium.js';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD.js';
import setup from './hooks/setup.js';
import './scss/main.scss';
import { injectViteHmrClient } from './utils/viteHmr.js';

function isCommanderSpellbladeCombatant(combatant: Combatant.Implementation): boolean {
	const actor = combatant.actor;
	if (!actor || actor.type !== 'character') return false;

	return actor.items.some((item) => {
		if (item.type !== 'subclass') return false;

		const parentClass = foundry.utils.getProperty(item, 'system.parentClass') as string | undefined;
		const identifier =
			(foundry.utils.getProperty(item, 'system.identifier') as string | undefined) ??
			item.name.slugify({ strict: true });
		return identifier === 'spellblade' && parentClass === 'commander';
	});
}

async function clearSpellbladeManaFromCombat(combat: Combat): Promise<void> {
	const updates = combat.combatants.reduce<Promise<unknown>[]>((acc, combatant) => {
		if (!isCommanderSpellbladeCombatant(combatant)) return acc;
		if (!combatant.actor?.isOwner) return acc;

		acc.push(
			combatant.actor.update({
				'system.resources.mana.baseMax': 0,
				'system.resources.mana.current': 0,
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

// Refresh tokens when combat ends to remove turn indicators
Hooks.on('deleteCombat', async (combat: Combat) => {
	await clearSpellbladeManaFromCombat(combat);

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
