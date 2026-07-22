export default function registerPredicateConfig(abilityScores: Record<string, string>) {
	const PREDICATE_KEY_CONFIG_MAPPING = {
		size: {
			tiny: 0,
			small: 1,
			medium: 2,
			large: 3,
			huge: 4,
			gargantuan: 5,
		},
	} as const;

	// Domain-tag keys populated after the prePrepareData dispatch. Predicates on
	// these keys never match for rules that apply in prePrepareData.
	const LATE_PREDICATE_KEYS = Object.freeze(Object.keys(abilityScores));

	return { PREDICATE_KEY_CONFIG_MAPPING, LATE_PREDICATE_KEYS };
}
