/** The rules of an actor as an array. Empty when it has no rules to read. */
export function actorRules<T>(actor: { rules?: unknown } | null | undefined): T[] {
	const rules = actor?.rules;
	if (!rules || typeof (rules as Iterable<unknown>)[Symbol.iterator] !== 'function') return [];
	return Array.from(rules as Iterable<T>);
}

/** What a card or a window calls a rule: its label, or the name of its item. */
export function ruleLabel(rule: {
	label?: string;
	item?: { name?: string | null } | null;
}): string {
	return rule.label || rule.item?.name || '';
}

/** The key of a rule on its item. */
export function ruleKey(rule: {
	id?: string | null;
	item?: { uuid?: string | null } | null;
}): string {
	return `${rule.item?.uuid ?? ''}:${rule.id ?? ''}`;
}
