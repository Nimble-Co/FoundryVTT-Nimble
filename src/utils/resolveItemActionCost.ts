const DEFAULT_ACTION_COST = 1;

interface ItemWithActivationCost {
	system?: {
		activation?: {
			cost?: { type?: string; quantity?: number };
		};
	};
}

export default function resolveItemActionCost(item: ItemWithActivationCost | null): number {
	const cost = item?.system?.activation?.cost;
	if (!cost || cost.type !== 'action') return DEFAULT_ACTION_COST;
	const quantity = Number(cost.quantity ?? DEFAULT_ACTION_COST);
	return Number.isFinite(quantity) && quantity >= 1 ? quantity : DEFAULT_ACTION_COST;
}
