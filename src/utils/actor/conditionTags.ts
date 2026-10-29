import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';

// These conditions have tags of their own, with rules of their own.
const OWN_TAGS = new Set<string>([STATUS_EFFECT_IDS.bloodied, STATUS_EFFECT_IDS.concentration]);

/**
 * The conditions a creature with these statuses has, for its `self:` and
 * `target:` tags: each condition among the statuses, and the conditions an
 * alias stands for.
 */
export function conditionTags(statuses: ReadonlySet<string>): Set<string> {
	const conditions = (CONFIG.NIMBLE?.conditions ?? {}) as Record<string, string>;
	const aliases = (CONFIG.NIMBLE?.conditionAliasedConditions ?? {}) as Record<
		string,
		readonly string[] | undefined
	>;
	const found = new Set<string>();
	for (const status of statuses) {
		if (!(status in conditions)) continue;
		found.add(status);
		for (const alias of aliases[status] ?? []) found.add(alias);
	}
	for (const own of OWN_TAGS) found.delete(own);
	return found;
}
