export interface EditableActivationCost {
	type?: string;
	isReaction?: boolean;
}

export type ActivationCostUpdate = Record<`system.activation.cost.${string}`, unknown>;

const QUANTIFIED_COST_TYPES = ['action', 'minute', 'hour'];

/** A reaction cost has one shape: `type: 'action'` plus `isReaction`, with `quantity: 0` when free. */
const FREE_REACTION_COST = {
	'system.activation.cost.type': 'action',
	'system.activation.cost.quantity': 0,
} as const;

export function reactionFlagUpdate(
	cost: EditableActivationCost,
	isReaction: boolean,
): ActivationCostUpdate {
	if (isReaction && cost.type === 'none') {
		return { 'system.activation.cost.isReaction': true, ...FREE_REACTION_COST };
	}

	return { 'system.activation.cost.isReaction': isReaction };
}

export function costTypeUpdate(cost: EditableActivationCost, type: string): ActivationCostUpdate {
	if (cost.isReaction && type === 'none') return { ...FREE_REACTION_COST };

	return { 'system.activation.cost.type': type };
}

export function showsCostQuantity(type: string | undefined): boolean {
	return QUANTIFIED_COST_TYPES.includes(type ?? '');
}

export function costQuantityMin(type: string | undefined): number {
	return type === 'action' ? 0 : 1;
}
