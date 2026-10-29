import { systemHookName } from '#system';
import { findRequestedPool } from '#utils/dicePool/findRequestedPool.js';
import { pendingSpendRequests } from '#utils/dicePool/pendingSpendRequests.js';
import type { DicePoolSpendRequestPayload } from '#utils/dicePool/types.js';
import localize from '#utils/localize.js';
import { asRevealable, type RevealableSheet } from '#view/actorSheets/shared/revealable.js';

interface ActorWithSheet {
	sheet?: { rendered?: boolean; render?: (force: boolean) => unknown } | null;
}

/** The new character sheet opens the choice step of the feature row, on the Actions tab. */
function revealSpend(
	actor: ActorWithSheet,
	sheet: RevealableSheet,
	payload: DicePoolSpendRequestPayload,
): void {
	const pool = findRequestedPool(actor as Actor, payload);
	if (!pool) return;
	if (pool.faces.length < 1) {
		ui.notifications?.info(
			localize('NIMBLE.dicePoolTracker.spendRequestEmptyPool', { label: pool.label }),
		);
		return;
	}
	sheet.reveal({ tab: 'actions', rowId: payload.itemId, step: 'choice' });
}

/**
 * The route of `dicePool.requestSpend`. The new character sheet takes it through `reveal()`.
 * The old sheet's live listener is mounted with its DicePoolTracker, so a request fired while
 * that sheet is closed (hotbar macro, token HUD) would vanish: park it and open the sheet; the
 * tracker consumes it on mount.
 */
export default function registerDicePoolSpendRequestRouter(): void {
	// @ts-expect-error - dicePool.requestSpend is a custom Nimble hook
	Hooks.on(systemHookName('dicePool.requestSpend'), (payload: DicePoolSpendRequestPayload) => {
		if (!payload?.actorUuid) return;

		const actor = fromUuidSync(
			payload.actorUuid as Parameters<typeof fromUuidSync>[0],
		) as ActorWithSheet | null;
		const sheet = actor?.sheet;
		const revealable = asRevealable(sheet);
		if (actor && revealable) {
			revealSpend(actor, revealable, payload);
			return;
		}
		// A rendered sheet has a mounted tracker that handles the request live.
		if (!sheet?.render || sheet.rendered) return;

		pendingSpendRequests.set(payload);
		sheet.render(true);
	});
}
