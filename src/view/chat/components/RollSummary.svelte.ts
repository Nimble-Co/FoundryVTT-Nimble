import type { RollSummaryOptions } from '#types/components/RollSummary.d.ts';

import localize from '#utils/localize.ts';

export function getPrimaryDieBreakdown(options: RollSummaryOptions | undefined): string | null {
	const modifier = Number(options?.rollOptions?.primaryDieModifier) || 0;
	const base = options?.rollOptions?.primaryDieBaseResult;
	if (!modifier || base == null) return null;

	const faces = options?.roll?.terms?.find((term) => term?.faces)?.faces;
	const sum = base + modifier;
	const excess = faces && sum > faces ? sum - faces : 0;

	return localize(
		excess
			? 'NIMBLE.hitDice.primaryDieModifierBreakdownCapped'
			: 'NIMBLE.hitDice.primaryDieModifierBreakdown',
		{
			base: String(base),
			modifier: modifier > 0 ? `+${modifier}` : String(modifier),
			result: String(sum - excess),
			excess: String(excess),
		},
	);
}
