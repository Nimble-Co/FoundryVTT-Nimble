import type { ConditionRollMode } from '#types/conditionRollMode.d.ts';

interface ConditionHolder {
	toggleStatusEffect?(statusId: string, options: { active: boolean }): Promise<unknown>;
}

/** Ends each condition of the roller that ends after the roll that used it (Despair). */
export async function endUsedConditions(
	roller: ConditionHolder | null | undefined,
	used: readonly ConditionRollMode[],
): Promise<void> {
	for (const line of used) {
		if (line.ends && line.side === 'self') {
			await roller?.toggleStatusEffect?.(line.condition, { active: false });
		}
	}
}
