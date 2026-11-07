interface EditableActivationCost {
	type?: string;
	isReaction?: boolean;
}

type ActivationCostUpdate = Record<`system.activation.cost.${string}`, unknown>;

const QUANTIFIED_COST_TYPES = ['action', 'minute', 'hour'];

/** A reaction cost has one shape: `type: 'action'` plus `isReaction`, with `quantity: 0` when free. */
const FREE_REACTION_COST = {
	'system.activation.cost.type': 'action',
	'system.activation.cost.quantity': 0,
} as const;

const USUAL_REACTION_COST = {
	'system.activation.cost.type': 'action',
	'system.activation.cost.quantity': 1,
} as const;

export function reactionFlagUpdate(
	cost: EditableActivationCost,
	isReaction: boolean,
): ActivationCostUpdate {
	if (!isReaction || cost.type === 'action') {
		return { 'system.activation.cost.isReaction': isReaction };
	}

	const shape = cost.type === 'none' ? FREE_REACTION_COST : USUAL_REACTION_COST;
	return { 'system.activation.cost.isReaction': true, ...shape };
}

/** On a reaction, None means a free reaction and a time unit ends the reaction. */
export function costTypeUpdate(cost: EditableActivationCost, type: string): ActivationCostUpdate {
	if (!cost.isReaction || type === 'action') return { 'system.activation.cost.type': type };
	if (type === 'none') return { ...FREE_REACTION_COST };

	return { 'system.activation.cost.type': type, 'system.activation.cost.isReaction': false };
}

export function showsCostQuantity(type: string | undefined): boolean {
	return QUANTIFIED_COST_TYPES.includes(type ?? '');
}

export function costQuantityMin(type: string | undefined): number {
	return type === 'action' ? 0 : 1;
}
