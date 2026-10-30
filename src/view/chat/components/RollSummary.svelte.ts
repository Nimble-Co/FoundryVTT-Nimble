import type { RollSummaryOptions } from '#types/components/RollSummary.d.ts';

import localize from '#utils/localize.ts';

import { primaryDieBonusText } from './primaryDieBonusText.ts';

/**
 * The Primary Die face before the number added to it, the number, and the
 * result, such as "Primary Die: 5 + 1 = 6". The die stops at its max and at 1.
 * The tooltip names who added the number. Null when no number was added, or
 * the face before it is not known.
 */
export function getPrimaryDieBreakdown(
	options: RollSummaryOptions | undefined,
): { text: string; tooltip: string } | null {
	const modifier = Math.trunc(Number(options?.rollOptions?.primaryDieModifier) || 0);
	const base = options?.rollOptions?.primaryDieBaseResult;
	if (!modifier || typeof base !== 'number') return null;

	const faces = options?.roll?.terms?.find((term) => term?.faces)?.faces;
	const sum = base + modifier;
	const result = Math.max(1, faces ? Math.min(sum, faces) : sum);
	const key =
		result < sum
			? 'NIMBLE.hitDice.primaryDieModifierBreakdownMax'
			: result > sum
				? 'NIMBLE.hitDice.primaryDieModifierBreakdownLowest'
				: 'NIMBLE.hitDice.primaryDieModifierBreakdown';
	const text = localize(key, {
		sum: `${base} ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)}`,
		result: String(result),
	});
	const tooltip = primaryDieBonusText(modifier, options?.primaryDieBonuses ?? [])?.tooltip ?? '';
	return { text, tooltip };
}
