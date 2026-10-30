import type { OtherCreature } from '#types/otherCreature.d.ts';
import { Predicate, type RawPredicate } from '../../etc/Predicate.js';
import { buildTargetDomain } from '../../utils/actor/conditionalBonuses.js';

interface RuleOwner {
	getDomain(): Set<string>;
	getFlag(scope: string, key: string): unknown;
}

/**
 * Whether the other creature of a roll is what a rule's "only when the other
 * creature is" predicate asks for. The test sees the other creature's
 * `target:` tags with the marks the owner put on it, and the owner's and the
 * item's own tags without their `target:` tags. An empty predicate always
 * passes; a set one fails when there is no other creature.
 */
function otherCreatureMatches(
	raw: Predicate | RawPredicate | null | undefined,
	owner: RuleOwner | null | undefined,
	itemDomain: Iterable<string>,
	other: OtherCreature | null | undefined,
): boolean {
	const predicate = raw instanceof Predicate ? raw : new Predicate((raw ?? {}) as RawPredicate);
	if (predicate.size === 0) return true;
	if (!other) return false;
	const domain = buildTargetDomain(owner, other);
	for (const tag of [...(owner?.getDomain() ?? []), ...itemDomain]) {
		if (!tag.startsWith('target:')) domain.add(tag);
	}
	return predicate.test(domain);
}

/** `otherCreatureMatches` for a rule: its actor is the owner, its item gives the item tags. */
export function ruleOtherCreatureMatches(
	rule: { actor: unknown; item: { getDomain(): Set<string> } },
	raw: Predicate | RawPredicate | null | undefined,
	other: OtherCreature | null | undefined,
): boolean {
	return otherCreatureMatches(raw, rule.actor as RuleOwner, rule.item.getDomain(), other);
}
