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

const pendingCombatantActionMutations = new Map<string, Promise<void>>();

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
	await (pendingCombatantActionMutations.get(mutationKey) ?? Promise.resolve());
}

function clearForCombat(combatId: string | null | undefined): void {
	const normalizedCombatId = String(combatId ?? '').trim();
	if (!normalizedCombatId) return;
	const keyPrefix = `${normalizedCombatId}:`;
	for (const mutationKey of pendingCombatantActionMutations.keys()) {
		if (!mutationKey.startsWith(keyPrefix)) continue;
		pendingCombatantActionMutations.delete(mutationKey);
	}
}

function queue<T>(params: CombatantActionMutationParams<T>): Promise<T> {
	const mutationKey = getCombatantActionMutationKey(params);
	if (!mutationKey) return params.mutation();

	const previousMutation = pendingCombatantActionMutations.get(mutationKey) ?? Promise.resolve();
	const mutationPromise = previousMutation.catch(() => undefined).then(() => params.mutation());
	const queuePromise = mutationPromise.then(
		() => undefined,
		() => undefined,
	);
	pendingCombatantActionMutations.set(mutationKey, queuePromise);
	void queuePromise.finally(() => {
		if (pendingCombatantActionMutations.get(mutationKey) === queuePromise) {
			pendingCombatantActionMutations.delete(mutationKey);
		}
	});
	return mutationPromise;
}

export const combatantActionMutationQueue: CombatantActionMutationQueue = {
	queue,
	waitForCombatant,
	clearForCombat,
};
