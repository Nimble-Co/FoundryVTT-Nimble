/**
 * Hook listener for nimble.preApplyCondition that blocks conditions
 * the target actor is immune to. Immunity is populated by
 * ConditionImmunityRule during data preparation.
 */
export function conditionImmunityGuard(context: {
	target: { system?: { conditionImmunities?: Set<string> } };
	condition: string;
}): boolean | undefined {
	const immunities = (context.target.system as { conditionImmunities?: Set<string> } | undefined)
		?.conditionImmunities;
	if (immunities?.has(context.condition)) return false;
	return undefined;
}

/**
 * Check whether an actor is immune to a given condition.
 * Used by automaticConditions.ts to guard the direct toggleStatusEffect path.
 */
export function isConditionImmune(
	actor: { system?: unknown } | null | undefined,
	conditionId: string,
): boolean {
	const immunities = (actor?.system as { conditionImmunities?: Set<string> } | undefined)
		?.conditionImmunities;
	return immunities?.has(conditionId) ?? false;
}
