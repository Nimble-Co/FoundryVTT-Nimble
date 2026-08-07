import { systemHookName } from '#system';
import { pendingSpendRequests } from '#utils/dicePool/pendingSpendRequests.js';
import type { DicePoolSpendRequestPayload } from '#utils/dicePool/types.js';

interface ActorWithSheet {
	sheet?: { rendered?: boolean; render?: (force: boolean) => unknown } | null;
}

/**
 * Application-level fallback for `dicePool.requestSpend`: the live listener is
 * mounted with the character sheet's DicePoolTracker, so a request fired while
 * the sheet is closed (hotbar macro, token HUD) would otherwise vanish. Park
 * the request and open the sheet; the tracker consumes it on mount.
 */
export default function registerDicePoolSpendRequestRouter(): void {
	// @ts-expect-error - dicePool.requestSpend is a custom Nimble hook
	Hooks.on(systemHookName('dicePool.requestSpend'), (payload: DicePoolSpendRequestPayload) => {
		if (!payload?.actorUuid) return;

		const actor = fromUuidSync(
			payload.actorUuid as Parameters<typeof fromUuidSync>[0],
		) as ActorWithSheet | null;
		const sheet = actor?.sheet;
		// A rendered sheet has a mounted tracker that handles the request live.
		if (!sheet?.render || sheet.rendered) return;

		pendingSpendRequests.set(payload);
		sheet.render(true);
	});
}
