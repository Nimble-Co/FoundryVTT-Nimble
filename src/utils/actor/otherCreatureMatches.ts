import { Predicate, type RawPredicate } from '../../etc/Predicate.js';
import { buildTargetDomain } from './conditionalBonuses.js';

/** The creature on the other side of a roll, as a rule tests it. */
interface OtherCreature {
	uuid?: string;
	getTargetDomain?(): Set<string>;
}

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
export function otherCreatureMatches(
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

export type { OtherCreature };
