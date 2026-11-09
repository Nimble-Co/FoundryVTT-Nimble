import type { ConditionCreature, ConditionRollMode } from '#types/conditionRollMode.d.ts';

/** Ends each condition of the roller that ends after the roll that used it (Despair). */
export async function endUsedConditions(
	roller: Pick<ConditionCreature, 'toggleStatusEffect'> | null | undefined,
	used: readonly ConditionRollMode[],
): Promise<void> {
	for (const line of used) {
		if (line.ends && line.side === 'self') {
			await roller?.toggleStatusEffect?.(line.condition, { active: false });
		}
	}
}
