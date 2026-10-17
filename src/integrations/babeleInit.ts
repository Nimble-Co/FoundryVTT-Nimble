type BabeleApi = {
	setSystemTranslationsDir(dir: string): void;
	registerConverter(name: string, fn: BabeleConverter): void;
};

type BabeleConverter = (value: unknown, translation: unknown) => unknown;

type RawRule = { id?: string; label?: string } & Record<string, unknown>;
type RuleTranslation = { label?: string } & Record<string, unknown>;
type RuleTranslationMap = Record<string, RuleTranslation>;

type RawResult = { _id?: string; name?: string; description?: string } & Record<string, unknown>;
type ResultTranslation = { name?: string; description?: string };
type ResultTranslationMap = Record<string, ResultTranslation>;

type BabeleInitHook = (event: 'babele.init', fn: (babele: BabeleApi) => void) => number;

function translateRules(rules: unknown, translation: unknown): unknown {
	if (!Array.isArray(rules) || !translation || typeof translation !== 'object') return rules;
	const map = translation as RuleTranslationMap;
	return (rules as RawRule[]).map((rule, index) => {
		// `index:N` fallback assumes Foundry preserves source-pack rule order between
		// pack load and converter invocation. If a rule has no stable `id`, reordering
		// would shift its translation onto a neighbour — prefer id-keyed entries.
		const byId = rule?.id ? map[rule.id] : undefined;
		const byIndex = map[`index:${index}`];
		const override = byId ?? byIndex;
		if (!override) return rule;
		return { ...rule, ...override };
	});
}

function translateTableResults(results: unknown, translation: unknown): unknown {
	if (!Array.isArray(results) || !translation || typeof translation !== 'object') return results;
	const map = translation as ResultTranslationMap;
	return (results as RawResult[]).map((result) => {
		const override = result?._id ? map[result._id] : undefined;
		if (!override) return result;
		return { ...result, ...override };
	});
}

export default function registerBabeleHooks(): void {
	(Hooks.once as BabeleInitHook)('babele.init', (babele) => {
		babele.setSystemTranslationsDir('lang/babele');
		babele.registerConverter('nimbleRules', translateRules);
		babele.registerConverter('nimbleTableResults', translateTableResults);
	});
}
