/** The prepared rules of the effect, else its rule data (an effect that is not prepared, or is gone). */
export function rulesOfEffect<Rule>(effect: { rules?: unknown; system?: unknown }): Rule[] {
	const prepared = effect.rules as { values?(): Iterable<Rule> } | null | undefined;
	if (typeof prepared?.values === 'function') return [...prepared.values()];
	const source = (effect.system as { rules?: unknown } | null | undefined)?.rules;
	return Array.isArray(source) ? (source as Rule[]) : [];
}
