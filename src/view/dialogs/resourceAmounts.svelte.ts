import type { ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import { variableRangeOf } from '#utils/cost/resourceCost.js';

export interface VariableResourceCost {
	id: string;
	kind: ResourceCostKind;
	minimum: number;
	limit: number;
	amount: number;
}

/**
 * The amounts the player chooses for the variable Spend or Sacrifice costs of a use, each kept
 * inside its range.
 */
export function resourceAmounts(actor: unknown, costs: readonly ResourceCost[]) {
	const ranges = costs.flatMap((cost) => {
		const range = cost.id ? variableRangeOf(actor as never, cost) : null;
		return range ? [{ id: cost.id as string, kind: cost.kind, ...range }] : [];
	});
	let amounts = $state<Record<string, number>>(
		Object.fromEntries(ranges.map((range) => [range.id, range.minimum])),
	);
	const variableCosts = $derived<VariableResourceCost[]>(
		ranges.map((range) => ({ ...range, amount: amounts[range.id] ?? range.minimum })),
	);

	function set(id: string, value: number) {
		const range = ranges.find((candidate) => candidate.id === id);
		if (!range) return;
		const next = Number.isFinite(value) ? Math.floor(value) : range.minimum;
		amounts = { ...amounts, [id]: Math.clamp(next, range.minimum, range.limit) };
	}

	return {
		get amounts() {
			return amounts;
		},
		get variableCosts() {
			return variableCosts;
		},
		set,
		adjust(id: string, delta: number) {
			const range = ranges.find((candidate) => candidate.id === id);
			if (range) set(id, (amounts[id] ?? range.minimum) + delta);
		},
		/** The costs with the chosen amounts in place. */
		chosen(): ResourceCost[] {
			return costs.map((cost) =>
				cost.id && cost.id in amounts ? { ...cost, amount: amounts[cost.id] } : cost,
			);
		},
	};
}
