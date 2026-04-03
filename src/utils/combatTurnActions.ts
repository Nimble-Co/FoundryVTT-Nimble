import { combatantActionMutationQueue } from './combatantActionMutationQueue.js';

export const COMBATANT_ACTIONS_CURRENT_PATH = 'system.actions.base.current';
export const COMBATANT_ACTIONS_MAX_PATH = 'system.actions.base.max';
const COMBAT_TURN_SOCKET_NAME = 'system.nimble';
const ADVANCE_COMBAT_TURN_REQUEST_TYPE = 'advanceCombatTurn';

type AdvanceCombatTurnRequest = {
	type: typeof ADVANCE_COMBAT_TURN_REQUEST_TYPE;
	combatId: string;
	userId: string;
	activeCombatantId: string | null;
};

function toFiniteNonNegativeNumber(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 0;
	return Math.max(0, numericValue);
}

export function getCombatantCurrentActions(combatant: Combatant.Implementation): number {
	return toFiniteNonNegativeNumber(
		foundry.utils.getProperty(combatant, COMBATANT_ACTIONS_CURRENT_PATH),
	);
}

export function getCombatantMaxActions(combatant: Combatant.Implementation): number {
	return toFiniteNonNegativeNumber(
		foundry.utils.getProperty(combatant, COMBATANT_ACTIONS_MAX_PATH),
	);
}

export function resolveCombatantCurrentActionsAfterDelta(params: {
	currentActions: number;
	maxActions: number;
	delta: number;
	allowOverflow?: boolean;
}): number {
	const rawCurrent = Math.floor(toFiniteNonNegativeNumber(params.currentActions));
	const normalizedMax = Math.max(0, Math.floor(toFiniteNonNegativeNumber(params.maxActions)));
	const numericDelta = Number(params.delta);
	const normalizedDelta = Number.isFinite(numericDelta) ? Math.trunc(numericDelta) : 0;
	const normalizedCurrent = params.allowOverflow
		? Math.max(0, rawCurrent)
		: Math.min(normalizedMax, Math.max(0, rawCurrent));
	const nextActions = normalizedCurrent + normalizedDelta;
	if (params.allowOverflow) return Math.max(0, nextActions);
	return Math.min(normalizedMax, Math.max(0, nextActions));
}

export function canCurrentUserEndTurn(combatant: Combatant.Implementation | null): boolean {
	if (!combatant) return false;
	if (game.user?.isGM) return true;
	return Boolean(combatant.actor?.isOwner);
}

function getPrimaryActiveGmId(): string | null {
	const usersCollection = game.users as unknown as {
		activeGM?: { id?: string | null } | null;
		contents?: Array<{ active?: boolean; id?: string | null; isGM?: boolean }>;
	};
	const activeGmId = usersCollection.activeGM?.id ?? null;
	if (activeGmId) return activeGmId;
	return (
		usersCollection.contents?.find((user) => user.isGM === true && user.active === true)?.id ?? null
	);
}

function getUserById(userId: string | null | undefined): User.Implementation | null {
	if (!userId) return null;
	const usersCollection = game.users as unknown as {
		get?: (id: string) => User.Implementation | null;
		contents?: User.Implementation[];
	};
	return (
		usersCollection.get?.(userId) ??
		usersCollection.contents?.find((user) => user.id === userId) ??
		null
	);
}

function canUserEndTurnForCombatant(
	combatant: Combatant.Implementation | null,
	user: User.Implementation | null,
): boolean {
	if (!combatant || !user) return false;
	if (user.isGM) return true;
	return Boolean(
		combatant.actor?.testUserPermission?.(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
	);
}

function getCombatById(combatId: string | null | undefined): Combat | null {
	if (!combatId) return null;
	const combatsCollection = game.combats as unknown as {
		get?: (id: string) => Combat | null;
		contents?: Combat[];
	};
	return (
		combatsCollection.get?.(combatId) ??
		combatsCollection.contents?.find((combat) => (combat.id ?? combat._id ?? null) === combatId) ??
		null
	);
}

async function handleAdvanceCombatTurnRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<AdvanceCombatTurnRequest>;
	if (request.type !== ADVANCE_COMBAT_TURN_REQUEST_TYPE) return;

	const combat = getCombatById(request.combatId);
	if (!combat?.started) return;
	if ((combat.combatant?.id ?? null) !== (request.activeCombatantId ?? null)) return;

	const requestingUser = getUserById(request.userId);
	if (!canUserEndTurnForCombatant(combat.combatant ?? null, requestingUser)) return;

	await combat.nextTurn();
}

let hasRegisteredCombatTurnSocketListener = false;

export function registerCombatTurnSocketListener(): void {
	if (hasRegisteredCombatTurnSocketListener) return;
	hasRegisteredCombatTurnSocketListener = true;

	const socket = game.socket as
		| {
				on?: (eventName: string, listener: (payload: unknown) => void) => void;
		  }
		| undefined;
	socket?.on?.(COMBAT_TURN_SOCKET_NAME, (payload) => {
		void handleAdvanceCombatTurnRequest(payload);
	});
	Hooks.on('deleteCombat', (combat: Combat) => {
		combatantActionMutationQueue.clearForCombat(combat.id ?? combat._id ?? null);
	});
}

export async function requestAdvanceCombatTurn(params: {
	combat: Combat;
	activeCombatantId?: string | null;
}): Promise<boolean> {
	const activeCombatant = params.combat.combatant ?? null;
	if (!activeCombatant) return false;
	const activeCombatantId = params.activeCombatantId ?? activeCombatant.id ?? null;
	await combatantActionMutationQueue.waitForCombatant({
		combat: params.combat,
		combatantId: activeCombatantId,
	});

	if (game.user?.isGM) {
		await params.combat.nextTurn();
		return true;
	}

	if (!canCurrentUserEndTurn(activeCombatant)) return false;
	if (!game.user?.id) return false;
	if (!getPrimaryActiveGmId()) return false;

	const socket = game.socket as
		| {
				emit?: (eventName: string, payload: AdvanceCombatTurnRequest) => void;
		  }
		| undefined;
	if (!socket?.emit) return false;

	socket.emit(COMBAT_TURN_SOCKET_NAME, {
		type: ADVANCE_COMBAT_TURN_REQUEST_TYPE,
		combatId: params.combat.id ?? params.combat._id ?? '',
		userId: game.user.id,
		activeCombatantId,
	});
	return true;
}

export async function consumeCombatantAction(params: {
	combat: Combat;
	combatantId: string;
	fallbackCombatant?: Combatant.Implementation | null;
	actionCost?: number;
}): Promise<number> {
	const combatant =
		params.combat.combatants.get(params.combatantId) ?? params.fallbackCombatant ?? null;
	if (!combatant) return 0;

	const currentActions = getCombatantCurrentActions(combatant);
	if (currentActions < 1) return 0;

	const cost = Number(params.actionCost ?? 1);
	const normalizedCost = Number.isFinite(cost) && cost >= 1 ? cost : 1;
	const nextActions = Math.max(0, currentActions - normalizedCost);
	const actionUpdate: Record<string, unknown> = {
		_id: params.combatantId,
		[COMBATANT_ACTIONS_CURRENT_PATH]: nextActions,
	};
	await params.combat.updateEmbeddedDocuments('Combatant', [actionUpdate]);
	return nextActions;
}

export async function maybeAdvanceTurnForCombatant(params: {
	combat: Combat;
	combatantId: string | null | undefined;
	endTurn: boolean;
}): Promise<boolean> {
	if (!params.endTurn) return false;
	const activeCombatantId = params.combat.combatant?.id ?? null;
	if (!activeCombatantId || !params.combatantId) return false;
	if (activeCombatantId !== params.combatantId) return false;
	return requestAdvanceCombatTurn({
		combat: params.combat,
		activeCombatantId,
	});
}
