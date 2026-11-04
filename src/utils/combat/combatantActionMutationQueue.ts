import { keyedQueue } from '../keyedQueue.js';

type CombatantActionMutationParams<T> = {
	combat: Combat;
	combatantId: string | null | undefined;
	mutation: () => Promise<T>;
};

type WaitForCombatantMutationParams = {
	combat: Combat;
	combatantId: string | null | undefined;
};

type CombatantActionMutationQueue = {
	queue: <T>(params: CombatantActionMutationParams<T>) => Promise<T>;
	waitForCombatant: (params: WaitForCombatantMutationParams) => Promise<void>;
	clearForCombat: (combatId: string | null | undefined) => void;
};

const pendingCombatantActionMutations = keyedQueue();

function getCombatDocumentId(combat: Combat): string {
	const combatId = combat.id ?? combat._id ?? '';
	return String(combatId);
}

function getCombatantActionMutationKey(params: {
	combat: Combat;
	combatantId: string | null | undefined;
}): string | null {
	if (!params.combatantId) return null;
	const combatId = getCombatDocumentId(params.combat);
	if (!combatId) return null;
	return `${combatId}:${params.combatantId}`;
}

async function waitForCombatant(params: WaitForCombatantMutationParams): Promise<void> {
	const mutationKey = getCombatantActionMutationKey(params);
	if (!mutationKey) return;
	await pendingCombatantActionMutations.settled(mutationKey);
}

function clearForCombat(combatId: string | null | undefined): void {
	const normalizedCombatId = String(combatId ?? '').trim();
	if (!normalizedCombatId) return;
	const keyPrefix = `${normalizedCombatId}:`;
	pendingCombatantActionMutations.forget((mutationKey) => mutationKey.startsWith(keyPrefix));
}

function queue<T>(params: CombatantActionMutationParams<T>): Promise<T> {
	const mutationKey = getCombatantActionMutationKey(params);
	if (!mutationKey) return params.mutation();

	return pendingCombatantActionMutations.run(mutationKey, () => params.mutation());
}

export const combatantActionMutationQueue: CombatantActionMutationQueue = {
	queue,
	waitForCombatant,
	clearForCombat,
};
