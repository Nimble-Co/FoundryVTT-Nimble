export type TokenSet = 'light' | 'dark' | 'chrome';

const SETS: [TokenSet, string][] = [
	['light', '.theme-light'],
	['dark', '.theme-dark'],
	['chrome', '.nimble-chrome'],
];

function* styleRules(rules: CSSRuleList): Generator<CSSStyleRule> {
	for (const rule of Array.from(rules)) {
		if (rule instanceof CSSStyleRule) yield rule;
		else if ('cssRules' in rule) yield* styleRules((rule as CSSGroupingRule).cssRules);
	}
}

/** Each `--nimble-*` name in the loaded stylesheets, with the token sets that declare it. */
export function readTokens(): Map<string, Set<TokenSet>> {
	const tokens = new Map<string, Set<TokenSet>>();
	for (const sheet of Array.from(document.styleSheets)) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const rule of styleRules(rules)) {
			const selectors = rule.selectorText.split(',').map((s) => s.trim());
			const sets = SETS.filter(([, selector]) => selectors.includes(selector)).map(([set]) => set);
			if (!sets.length) continue;
			for (const name of Array.from(rule.style)) {
				if (!name.startsWith('--nimble-')) continue;
				const entry = tokens.get(name) ?? new Set<TokenSet>();
				for (const set of sets) entry.add(set);
				tokens.set(name, entry);
			}
		}
	}
	return new Map([...tokens].sort(([a], [b]) => a.localeCompare(b)));
}

/** The value of a token as an element in that set computes it. */
export function valueIn(element: Element, name: string): string {
	return getComputedStyle(element).getPropertyValue(name).trim();
}

export const isColour = (value: string) =>
	value.includes('gradient(') || (value !== '' && CSS.supports('color', value));
