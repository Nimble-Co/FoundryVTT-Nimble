import type { ConditionalDamage } from '#types/conditionalDamage.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import type { ChosenUseOption, UseOption, UseOptionGroup } from '#types/useOption.d.ts';
import { variableRangeOf, wholeAmount } from '../../utils/cost/resourceCost.js';

/** What the picks of the chosen split options add to the attack. */
export interface PickRiders {
	/** Rolled as damage of their own. */
	damages: ConditionalDamage[];
	/** Steps lower the target's armor counts for the whole attack. */
	lowerArmorSteps: number;
}

function optionOf(groups: readonly UseOptionGroup[], key: string): UseOption | null {
	for (const group of groups) {
		const option = group.options.find((each) => each.key === key);
		if (option) return option;
	}
	return null;
}

/** The damage of `count` units of a pick: "10" for 2 × 5, "1d6 + 1d6" for 2 × 1d6. */
function repeatedDamage(formula: string, count: number): string {
	const value = Number(formula);
	if (Number.isFinite(value)) return String(value * count);
	return Array.from({ length: count }, () => formula).join(' + ');
}

/**
 * The chosen options, with the picks of each split option kept inside its range, in the order of
 * its picks, and its amount the sum of its picks.
 */
export function withPickAmounts(
	actor: CostPayer,
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
): ChosenUseOption[] {
	return chosen.map((choice) => {
		const option = optionOf(groups, choice.key);
		if (!option?.picks) return choice;
		let left = variableRangeOf(actor, option.cost)?.limit ?? 0;
		const picks: Record<string, number> = {};
		for (const pick of option.picks) {
			const amount = Math.min(wholeAmount(choice.picks?.[pick.key]), left);
			if (amount > 0) picks[pick.key] = amount;
			left -= amount;
		}
		const amount = Object.values(picks).reduce((total, each) => total + each, 0);
		return { key: choice.key, amount, picks };
	});
}

/** What the picks of the chosen split options add to the attack. */
export function pickRidersOf(
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
): PickRiders {
	const riders: PickRiders = { damages: [], lowerArmorSteps: 0 };
	for (const choice of chosen) {
		const option = optionOf(groups, choice.key);
		for (const pick of option?.picks ?? []) {
			const count = wholeAmount(choice.picks?.[pick.key]);
			if (count === 0) continue;
			if (pick.damage) {
				riders.damages.push({
					formula: repeatedDamage(pick.damage, count),
					damageType: pick.damageType,
					label: pick.name,
					...(Number.isFinite(Number(pick.damage)) ? { modifierOnly: true } : {}),
				});
			}
			riders.lowerArmorSteps += count * pick.lowerArmorSteps;
		}
	}
	return riders;
}
