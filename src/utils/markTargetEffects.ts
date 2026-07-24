import { SYSTEM_ID } from '#system';
import { isActiveGM } from '#utils/isActiveGM.js';

/**
 * Flag stamped on each visible marker ActiveEffect, recording the uuid of the marking
 * item that created it. Eviction deletes only the effects carrying *this* item's uuid,
 * so one hunter clearing a quarry never removes another hunter's marker on the same
 * target.
 */
export const MARK_TARGET_ITEM_FLAG = 'markTargetItemUuid';

/**
 * Foundry system socket channel. Must be `system.<id>` so the request reaches the GM's
 * client, and derived from SYSTEM_ID so the emitter and listener stay in lockstep across
 * the stable (`nimble`) and dev (`nimble-dev`) installs.
 */
const MARK_TARGET_SOCKET_NAME = `system.${SYSTEM_ID}`;
const APPLY_MARK_EFFECT_REQUEST_TYPE = 'markTarget.applyEffect';
const REMOVE_MARK_EFFECT_REQUEST_TYPE = 'markTarget.removeEffect';

interface MarkEffect {
	id: string;
	getFlag(scope: string, key: string): unknown;
}

/** The subset of an ActiveEffect-bearing document the relay needs to read and mutate. */
export interface MarkEffectTarget {
	uuid: string;
	isOwner?: boolean;
	effects: Iterable<MarkEffect>;
	createEmbeddedDocuments(
		type: 'ActiveEffect',
		data: Array<Record<string, unknown>>,
	): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

interface ApplyMarkEffectRequest {
	type: typeof APPLY_MARK_EFFECT_REQUEST_TYPE;
	userId: string;
	targetUuid: string;
	sourceItemUuid: string;
	effectData: Record<string, unknown>;
}

interface RemoveMarkEffectRequest {
	type: typeof REMOVE_MARK_EFFECT_REQUEST_TYPE;
	userId: string;
	targetUuid: string;
	sourceItemUuid: string;
}

/** Ids of the marker ActiveEffects on `target` created by the item at `sourceItemUuid`. */
export function findMarkEffectIds(target: MarkEffectTarget, sourceItemUuid: string): string[] {
	const ids: string[] = [];
	for (const effect of target.effects) {
		if (effect.getFlag(SYSTEM_ID, MARK_TARGET_ITEM_FLAG) === sourceItemUuid) ids.push(effect.id);
	}
	return ids;
}

/** Whether this client may write ActiveEffects to `target` directly, without a GM relay. */
function canModifyTarget(target: MarkEffectTarget): boolean {
	return Boolean(game.user?.isGM) || Boolean(target.isOwner);
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
 * Creates the marker ActiveEffect on `target`, skipping if the source item already marks it
 * (re-marking a creature this item already marks is a no-op, never a duplicate stack).
 */
async function createMarkEffect(
	target: MarkEffectTarget,
	sourceItemUuid: string,
	effectData: Record<string, unknown>,
): Promise<void> {
	if (findMarkEffectIds(target, sourceItemUuid).length > 0) return;
	await target.createEmbeddedDocuments('ActiveEffect', [foundry.utils.deepClone(effectData)]);
}

/** Deletes only the marker ActiveEffects the source item created on `target`. */
async function deleteMarkEffects(target: MarkEffectTarget, sourceItemUuid: string): Promise<void> {
	const ids = findMarkEffectIds(target, sourceItemUuid);
	if (ids.length > 0) await target.deleteEmbeddedDocuments('ActiveEffect', ids);
}

/**
 * Applies a visible marker ActiveEffect to a target. The activating client owns the marking
 * item but usually not the target NPC, so it cannot create ActiveEffects on the target
 * directly (insufficient permissions). GMs/target owners write it directly; everyone else
 * relays the request to the active GM, mirroring the combat-turn socket proxy.
 */
export async function applyMarkEffect(params: {
	target: MarkEffectTarget;
	sourceItemUuid: string;
	effectData: Record<string, unknown>;
}): Promise<void> {
	const { target, sourceItemUuid, effectData } = params;

	if (canModifyTarget(target)) {
		await createMarkEffect(target, sourceItemUuid, effectData);
		return;
	}

	if (!game.user?.id) return;
	const socket = getSocket();
	if (!socket?.emit) return;

	const request: ApplyMarkEffectRequest = {
		type: APPLY_MARK_EFFECT_REQUEST_TYPE,
		userId: game.user.id,
		targetUuid: target.uuid,
		sourceItemUuid,
		effectData,
	};
	socket.emit(MARK_TARGET_SOCKET_NAME, request);
}

/**
 * Removes the marker ActiveEffect the source item created on a target (mark eviction).
 * Direct for GMs/owners, relayed to the active GM otherwise — the mirror of
 * {@link applyMarkEffect}.
 */
export async function removeMarkEffect(params: {
	target: MarkEffectTarget;
	sourceItemUuid: string;
}): Promise<void> {
	const { target, sourceItemUuid } = params;

	if (canModifyTarget(target)) {
		await deleteMarkEffects(target, sourceItemUuid);
		return;
	}

	if (!game.user?.id) return;
	const socket = getSocket();
	if (!socket?.emit) return;

	const request: RemoveMarkEffectRequest = {
		type: REMOVE_MARK_EFFECT_REQUEST_TYPE,
		userId: game.user.id,
		targetUuid: target.uuid,
		sourceItemUuid,
	};
	socket.emit(MARK_TARGET_SOCKET_NAME, request);
}

function getUserById(userId: string | null | undefined): User.Implementation | null {
	if (!userId) return null;
	const usersCollection = game.users as unknown as {
		get?: (id: string) => User.Implementation | null;
	};
	return usersCollection.get?.(userId) ?? null;
}

/**
 * A relayed request is honored only if the requesting user still owns the marking item's
 * actor — the same authorization the activation itself required — so a client cannot ask the
 * GM to stamp arbitrary effects onto actors it has no claim to.
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

async function resolveTarget(targetUuid: string): Promise<MarkEffectTarget | null> {
	const doc = await fromUuid(targetUuid as Parameters<typeof fromUuid>[0]);
	return (doc as MarkEffectTarget | null) ?? null;
}

async function handleApplyMarkEffectRequest(payload: unknown): Promise<void> {
	// The active GM is the single client that performs the privileged write.
	if (!isActiveGM()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<ApplyMarkEffectRequest>;
	if (request.type !== APPLY_MARK_EFFECT_REQUEST_TYPE) return;
	if (!request.userId || !request.targetUuid || !request.sourceItemUuid || !request.effectData) {
		return;
	}
	if (!isRequestAuthorized(request.userId, request.sourceItemUuid)) return;

	const target = await resolveTarget(request.targetUuid);
	if (!target) return;
	await createMarkEffect(target, request.sourceItemUuid, request.effectData);
}

async function handleRemoveMarkEffectRequest(payload: unknown): Promise<void> {
	if (!isActiveGM()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<RemoveMarkEffectRequest>;
	if (request.type !== REMOVE_MARK_EFFECT_REQUEST_TYPE) return;
	if (!request.userId || !request.targetUuid || !request.sourceItemUuid) return;
	if (!isRequestAuthorized(request.userId, request.sourceItemUuid)) return;

	const target = await resolveTarget(request.targetUuid);
	if (!target) return;
	await deleteMarkEffects(target, request.sourceItemUuid);
}

let hasRegisteredMarkTargetSocketListener = false;

/**
 * Registers the GM-side listener for relayed mark-effect requests. Idempotent, so it is safe
 * to call once from the `ready` hook.
 */
export function registerMarkTargetSocketListener(): void {
	if (hasRegisteredMarkTargetSocketListener) return;
	hasRegisteredMarkTargetSocketListener = true;

	const socket = getSocket();
	socket?.on?.(MARK_TARGET_SOCKET_NAME, (payload) => {
		void handleApplyMarkEffectRequest(payload);
		void handleRemoveMarkEffectRequest(payload);
	});
}
