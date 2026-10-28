const RESULT_OPTIONS = new Set(['netRollMode', 'primaryDieValue', 'primaryDieBaseResult']);

/**
 * Roll options for a reroll of a roll with `options`. A reroll keeps the
 * modifiers and drops results: a set primary die value and the values the
 * roll computed from its sources.
 */
function rerollOptions(
	options: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(options ?? {}).filter(([key]) => !RESULT_OPTIONS.has(key)),
	);
}

/** What a reroll adds on top of the roll it replaces. */
interface RerollChanges {
	/** Roll mode steps added to the roll's sources: -1 disadvantage, +1 advantage */
	rollModeChange: number;
	/** Added to the roll's primary die modifier */
	primaryDieBonus: number;
	/** Formula added to the damage, with references already resolved */
	extraDamage: string;
}

/** The formula and options of a reroll, with the reroll's own changes added. */
function prepareReroll(
	formula: string,
	options: Record<string, unknown> | null | undefined,
	changes: Partial<RerollChanges> = {},
): { formula: string; options: Record<string, unknown> } {
	const next = rerollOptions(options);

	const rollModeChange = Math.trunc(Number(changes.rollModeChange) || 0);
	if (rollModeChange !== 0) {
		const rollMode = typeof next.rollMode === 'number' ? next.rollMode : 0;
		const sources = Array.isArray(next.rollModeSources)
			? [...(next.rollModeSources as number[])]
			: [rollMode];
		sources.push(rollModeChange);
		next.rollModeSources = sources;
	}

	const primaryDieBonus = Math.trunc(Number(changes.primaryDieBonus) || 0);
	if (primaryDieBonus !== 0) {
		next.primaryDieModifier = (Number(next.primaryDieModifier) || 0) + primaryDieBonus;
	}

	const extraDamage = changes.extraDamage?.trim() ?? '';
	return {
		formula: extraDamage ? `${formula} + (${extraDamage})` : formula,
		options: next,
	};
}

export { prepareReroll, type RerollChanges };
