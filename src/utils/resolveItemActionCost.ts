interface ItemWithActivationCost {
	system?: {
		activation?: {
			cost?: { type?: string; quantity?: number };
		};
	};
}

export default function resolveItemActionCost(item: ItemWithActivationCost | null): number {
	const cost = item?.system?.activation?.cost;
	if (!cost || cost.type !== 'action') return 1;
	const quantity = Number(cost.quantity ?? 1);
	return Number.isFinite(quantity) && quantity >= 1 ? quantity : 1;
}
