import {
	getCombatantBaseActionMax,
	getCombatantPendingActionDelta,
} from '#documents/combat/combatantSystem.js';
import { SYSTEM_ID } from '#system';
import {
	getCombatantCurrentActions,
	resolveCombatantCurrentActionsAfterDelta,
} from './combatTurnActions.js';
import { isActiveGM } from './isActiveGM.js';
import { queueCombatantMutationWithFreshDocument } from './queueCombatantMutationWithFreshDocument.js';

/**
 * Foundry system socket channel. Must be `system.<id>` so the request reaches the GM's
 * client, and derived from SYSTEM_ID so the emitter and listener stay in lockstep across
 * the stable (`nimble`) and dev (`nimble-dev`) installs.
 */
const ACTION_DELTA_SOCKET_NAME = `system.${SYSTEM_ID}`;
const ACTION_DELTA_REQUEST_TYPE = 'actionDelta';

/** A combined adjustment to a character combatant's action pools. */
interface CombatantActionDeltas {
	/** Change to the current action pool, applied immediately. Overflow past max is allowed. */
	currentDelta: number;
	/** Change to the pending adjustment folded in at the combatant's next action refill. */
	pendingDelta: number;
}

interface CombatantActionDeltaRequest extends CombatantActionDeltas {
	type: typeof ACTION_DELTA_REQUEST_TYPE;
	combatId: string;
	combatantId: string;
	userId: string;
	sourceItemUuid: string;
}

function normalizeDelta(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 0;
	return Math.trunc(numericValue);
}

/**
 * The update object applying a combined current/pending action adjustment to a
 * character combatant, or `null` when nothing would change (non-character
 * combatant or an all-zero adjustment). Both pools are written in one update so
 * paired adjustments (e.g. gain now, owe next turn) can never half-apply.
 */
export function buildCombatantActionDeltaUpdate(
	combatant: Combatant.Implementation,
	deltas: CombatantActionDeltas,
): Record<string, unknown> | null {
	if (combatant.type !== 'character') return null;

	const currentDelta = normalizeDelta(deltas.currentDelta);
	const pendingDelta = normalizeDelta(deltas.pendingDelta);
	if (currentDelta === 0 && pendingDelta === 0) return null;

	const update: Record<string, unknown> = {};
	if (currentDelta !== 0) {
		update['system.actions.base.current'] = resolveCombatantCurrentActionsAfterDelta({
			currentActions: getCombatantCurrentActions(combatant),
			maxActions: getCombatantBaseActionMax(combatant),
			delta: currentDelta,
			allowOverflow: true,
		});
	}
	if (pendingDelta !== 0) {
		update['system.actions.pendingDelta'] =
			getCombatantPendingActionDelta(combatant) + pendingDelta;
	}
	return update;
}

async function applyCombatantActionDelta(params: {
	combat: Combat;
	combatantId: string;
	deltas: CombatantActionDeltas;
}): Promise<boolean> {
	return (
		(await queueCombatantMutationWithFreshDocument({
			combat: params.combat,
			combatantId: params.combatantId,
			mutation: async (combatant) => {
				const update = buildCombatantActionDeltaUpdate(combatant, params.deltas);
				if (!update) return false;
				await combatant.update(update);
				return true;
			},
		})) ?? false
	);
}

/** Whether this client may write the combatant's action pools directly, without a GM relay. */
function canModifyCombatant(combatant: Combatant.Implementation): boolean {
	return Boolean(game.user?.isGM) || Boolean(combatant.actor?.isOwner);
}

function getSocket():
	| {
			on?: (eventName: string, listener: (payload: unknown) => void) => void;
			emit?: (eventName: string, payload: unknown) => void;
	  }
	| undefined {
	return game.socket as ReturnType<typeof getSocket>;
}

/**
 * Applies a combined current/pending action adjustment to a character combatant. The
 * activating client owns the granting item but often not the affected combatant (an ally's
 * grant, a hostile denial), so it cannot write the combatant directly. GMs and combatant
 * owners apply the adjustment locally; everyone else relays the request to the active GM,
 * mirroring the mark-target socket proxy.
 *
 * Returns whether the adjustment was applied (direct) or successfully relayed.
 */
export async function requestCombatantActionDelta(params: {
	combat: Combat;
	combatantId: string;
	sourceItemUuid: string;
	deltas: CombatantActionDeltas;
}): Promise<boolean> {
	const { combat, combatantId, sourceItemUuid, deltas } = params;
	const combatant = combat.combatants.get(combatantId) ?? null;
	if (!combatant || combatant.type !== 'character') return false;

	if (canModifyCombatant(combatant)) {
		return applyCombatantActionDelta({ combat, combatantId, deltas });
	}

	if (!game.user?.id) return false;
	const socket = getSocket();
	if (!socket?.emit) return false;

	const request: CombatantActionDeltaRequest = {
		type: ACTION_DELTA_REQUEST_TYPE,
		combatId: combat.id ?? combat._id ?? '',
		combatantId,
		userId: game.user.id,
		sourceItemUuid,
		currentDelta: normalizeDelta(deltas.currentDelta),
		pendingDelta: normalizeDelta(deltas.pendingDelta),
	};
	socket.emit(ACTION_DELTA_SOCKET_NAME, request);
	return true;
}

function getUserById(userId: string | null | undefined): User.Implementation | null {
	if (!userId) return null;
	const usersCollection = game.users as unknown as {
		get?: (id: string) => User.Implementation | null;
	};
	return usersCollection.get?.(userId) ?? null;
}

/**
 * A relayed request is honored only if the requesting user still owns the granting item's
 * actor — the same authorization the activation itself required — so a client cannot ask
 * the GM to rewrite the action pools of combatants it has no claim to affect.
 */
function isRequestAuthorized(userId: string, sourceItemUuid: string): boolean {
	const user = getUserById(userId);
	if (!user) return false;
	if (user.isGM) return true;

	const item = fromUuidSync(sourceItemUuid as Parameters<typeof fromUuidSync>[0]) as {
		actor?: { testUserPermission?: (user: unknown, level: unknown) => boolean } | null;
	} | null;
	return Boolean(item?.actor?.testUserPermission?.(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
}

function getCombatById(combatId: string | null | undefined): Combat | null {
	if (!combatId) return null;
	const combatsCollection = game.combats as unknown as {
		get?: (id: string) => Combat | null;
	};
	return combatsCollection.get?.(combatId) ?? null;
}

async function handleCombatantActionDeltaRequest(payload: unknown): Promise<void> {
	// The active GM is the single client that performs the privileged write.
	if (!isActiveGM()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<CombatantActionDeltaRequest>;
	if (request.type !== ACTION_DELTA_REQUEST_TYPE) return;
	if (!request.combatId || !request.combatantId || !request.userId || !request.sourceItemUuid) {
		return;
	}
	if (!isRequestAuthorized(request.userId, request.sourceItemUuid)) return;

	const combat = getCombatById(request.combatId);
	if (!combat) return;
	const combatant = combat.combatants.get(request.combatantId) ?? null;
	if (!combatant || combatant.type !== 'character') return;

	await applyCombatantActionDelta({
		combat,
		combatantId: request.combatantId,
		deltas: {
			currentDelta: normalizeDelta(request.currentDelta),
			pendingDelta: normalizeDelta(request.pendingDelta),
		},
	});
}

let hasRegisteredCombatantActionDeltaSocketListener = false;

/**
 * Registers the GM-side listener for relayed action-adjustment requests. Idempotent, so it
 * is safe to call once from the `ready` hook.
 */
export function registerCombatantActionDeltaSocketListener(): void {
	if (hasRegisteredCombatantActionDeltaSocketListener) return;
	hasRegisteredCombatantActionDeltaSocketListener = true;

	const socket = getSocket();
	socket?.on?.(ACTION_DELTA_SOCKET_NAME, (payload) => {
		void handleCombatantActionDeltaRequest(payload);
	});
}
