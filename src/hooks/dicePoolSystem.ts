import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { isDicePoolFlagUpdate, syncActorPools } from '#utils/dicePool/dicePoolSync.js';

/**
 * Sync hooks ensure that the persisted flag state for dicePools stays consistent
 * with the rule definitions on the actor's items. This is data-integrity work,
 * not automation — when a rule is added/changed/removed, the flag bag is rebuilt
 * so consumers always see a coherent pool shape.
 *
 * Refill triggers (rest, encounter, onAttacked, etc.) are intentionally NOT
 * dispatched here. Automation gating is a system-wide concern that will be
 * handled centrally; consuming features wire their own refill behavior using
 * the helpers in `#utils/dicePool/dicePoolRefill.js`.
 */

async function syncItemActorPools(item: Item.Implementation | null | undefined): Promise<void> {
	if (!item?.actor || item.actor.type !== 'character') return;
	await syncActorPools(item.actor);
}

function registerItemSyncHooks(): void {
	Hooks.on('createItem', (item: Item.Implementation) => {
		void syncItemActorPools(item);
	});

	Hooks.on('updateItem', (item: Item.Implementation, _changes, options) => {
		if (isDicePoolFlagUpdate(options)) return;
		void syncItemActorPools(item);
	});

	Hooks.on('deleteItem', (item: Item.Implementation) => {
		void syncItemActorPools(item);
	});
}

function registerActorSyncHooks(): void {
	Hooks.on('updateActor', (actor: Actor.Implementation, changes, options) => {
		if (isDicePoolFlagUpdate(options)) return;
		if (actor.type !== 'character') return;
		if (foundry.utils.hasProperty(changes, DicePoolRuleConfig.flagPath)) return;

		void syncActorPools(actor);
	});
}

export default function registerDicePoolSystemHooks(): void {
	registerItemSyncHooks();
	registerActorSyncHooks();
}
