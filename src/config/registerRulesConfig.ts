import { RULE_CLASSES } from './ruleClasses.js';

export default function registerRulesConfig() {
	const ruleTypes = Object.fromEntries(
		Object.keys(RULE_CLASSES).map((type) => [type, `NIMBLE.ruleTypes.${type}`]),
	) as Record<keyof typeof RULE_CLASSES, string>;

	return { ruleDataModels: RULE_CLASSES, ruleTypes };
}
