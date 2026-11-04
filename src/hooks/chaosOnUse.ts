import { SYSTEM_ID, systemHookName } from '#system';
import {
	CHAOS_INVOKED_FLAG,
	CHAOS_TICKED_FLAG,
	invokeChaos,
	onUseTableOf,
} from '#utils/chaos/invokeChaos.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

interface UsedItem {
	actor?: Parameters<typeof invokeChaos>[0] | null;
	rules?: { values(): Iterable<unknown> };
}

interface UseCard {
	id?: string | null;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

/**
 * An item with a table roll on use: with Feature Effects on, it rolls once the card
 * exists. With them off, the card gets the Chaos button.
 */
export async function invokeChaosOnUse(item: UsedItem, card: UseCard | null): Promise<void> {
	const table = onUseTableOf(item);
	if (!table || !card?.id || !item.actor) return;
	if (!isRuleAutomationEnabled()) {
		await card.setFlag(SYSTEM_ID, CHAOS_TICKED_FLAG, true);
		return;
	}
	await card.setFlag(SYSTEM_ID, CHAOS_INVOKED_FLAG, true);
	await invokeChaos(item.actor, card.id, table);
}

let registered = false;

/** `useItem` fires on the client that used the item, after its card is made. */
export function registerChaosOnUseHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on(
		systemHookName('useItem') as never,
		((item: UsedItem, card: UseCard | null) => {
			void invokeChaosOnUse(item, card).catch((error) => {
				console.error('Nimble | Could not invoke Chaos.', error);
			});
		}) as never,
	);
}
