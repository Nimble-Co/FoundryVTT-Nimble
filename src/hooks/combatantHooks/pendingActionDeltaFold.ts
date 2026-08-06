import { getCombatantPendingActionDelta } from '#documents/combat/combatantSystem.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { queueCombatantMutationWithFreshDocument } from '#utils/queueCombatantMutationWithFreshDocument.js';
import { buildCombatantActionDeltaUpdate } from '#utils/requestCombatantActionDelta.js';

let didRegisterPendingActionDeltaFold = false;

/**
 * Move a character combatant's whole pending action adjustment onto their live
 * action pool as their turn begins.
 *
 * A pending adjustment means "on your next turn", but it is written at whatever
 * point in the round its source is activated, which may be after the recipient's
 * own turn has already ended. The turn-end refill also folds the pending amount,
 * so on its own it only delivers adjustments written before the recipient's turn
 * ended; anything written after that would sit untouched until the following
 * turn end and so arrive a turn late. Folding here as well makes the adjustment
 * land on the recipient's very next turn no matter when in the round it was
 * written.
 *
 * The fold is additive, never a reset. Between a character's turn end and their
 * next turn start, the base pool already IS their upcoming turn's pool, and
 * heroic reactions are spent out of it while it is not their turn. Rebuilding
 * the pool here would refund any reaction paid in that window.
 *
 * The two fold sites cannot double-apply: each clears the pending amount, so
 * whichever runs first leaves the other reading zero and writing nothing.
 *
 * The Dying action limit caps the turn-end refill's base value but not the
 * adjustment layered on top of it, so this deliberately does not cap either.
 *
 * Known gap: backward turn navigation (stepping to the previous turn or round)
 * dispatches no turn events at all, so no fold happens when a GM rewinds onto a
 * character who is owed an adjustment. The adjustment is not lost, only deferred
 * to their next turn end. Covering it would mean synthesising turn-start events
 * on the rewind paths, which every other turn-start consumer would then also see
 * (charge and dice pool recovery would re-trigger on a rewind), so the rewind
 * paths are left alone.
 */
async function foldPendingActionDelta(combatant: Combatant.Implementation): Promise<void> {
	if (combatant.type !== 'character') return;
	if (!combatant.id) return;

	const combat = (combatant.parent ?? null) as Combat | null;
	if (!combat) return;

	// When several turns advance at once (a round advance, or handing the turn
	// forward past other combatants) Foundry dispatches a turn start for every
	// combatant passed over, and on some of those paths follows it with an
	// absolute turn-end refill that would discard whatever we folded. Only the
	// combatant actually holding the turn folds; a passed-over combatant keeps
	// the amount pending for the turn they really play.
	if ((combat.combatant?.id ?? null) !== combatant.id) return;

	// Cheap early-out on a possibly stale snapshot so the overwhelmingly common
	// case writes nothing and never even takes the mutation queue. The queued
	// mutation re-reads the fresh document before writing, so a stale zero here
	// can only skip a fold, never produce a wrong one.
	if (getCombatantPendingActionDelta(combatant) === 0) return;

	await queueCombatantMutationWithFreshDocument({
		combat,
		combatantId: combatant.id,
		mutation: async (freshCombatant) => {
			const pendingDelta = getCombatantPendingActionDelta(freshCombatant);
			if (pendingDelta === 0) return;

			// Add the pending amount to `current` and cancel exactly that much out
			// of `pendingDelta`, in one update, using the same builder every other
			// action adjustment goes through so the clamping cannot drift.
			const update = buildCombatantActionDeltaUpdate(freshCombatant, {
				currentDelta: pendingDelta,
				pendingDelta: -pendingDelta,
			});
			if (!update) return;

			await freshCombatant.update(update);
		},
	});
}

export { foldPendingActionDelta };

export default function registerPendingActionDeltaFold(): void {
	if (didRegisterPendingActionDeltaFold) return;
	didRegisterPendingActionDeltaFold = true;

	// Gated to the single active GM. The turn-start hook is NOT emitted only on
	// the GM's client: the combat document also emits it from the post-advance
	// backstop, which runs on whichever client advanced the turn, and a player who
	// owns a combatant is allowed to advance. Without this gate a player's client
	// would try to fold, writing to a combatant it may not own and racing the GM's
	// own emission for the same turn.
	//
	// The existing pool-recovery consumers of this hook need no such gate because
	// they only touch the actor whose turn began, which the advancing player owns.
	// @ts-expect-error Custom hook
	Hooks.on('nimbleCombatTurnStart', (combatant: Combatant.Implementation) => {
		if (!isActiveGM()) return;
		void foldPendingActionDelta(combatant);
	});
}
