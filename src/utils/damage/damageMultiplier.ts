interface MultiplierRule {
	type?: string;
	disabled?: boolean;
	label?: string;
	multiplier?: number;
	test?(): boolean;
}

interface ItemWithRules {
	rules?: Iterable<unknown> | Map<string, unknown>;
}

/** The tick an item offers in its roll window, if it has one. */
export function damageMultiplierOf(
	item: ItemWithRules | null | undefined,
): { label: string; multiplier: number } | null {
	const rules = item?.rules;
	if (!rules) return null;
	const list = (rules instanceof Map ? [...rules.values()] : [...rules]) as MultiplierRule[];
	const rule = list.find(
		(each) => each?.type === 'damageMultiplier' && !each.disabled && each.test?.() !== false,
	);
	return rule ? { label: rule.label ?? '', multiplier: rule.multiplier ?? 2 } : null;
}
