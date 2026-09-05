/**
 * Item types whose spell grants can unlock cast tiers. Spells granted by
 * other item types (wands, scrolls, backgrounds) do not make a character a
 * caster and do not raise their unlocked tier.
 */
const TIER_GRANTING_ITEM_TYPES = new Set(['class', 'subclass', 'feature']);

interface GrantRuleLike {
	type?: string;
	disabled?: boolean;
	tiers?: unknown;
	predicate?: unknown;
	/** Optional because plain objects satisfy this structural type in tests. */
	appliesTo?: () => boolean;
}

interface RuleBackedItemLike {
	type?: string;
	rules?: Map<string, GrantRuleLike>;
}

interface SpellTierActorLike {
	items?: { contents?: RuleBackedItemLike[] };
}

/**
 * Whether the grant anchors its tiers to a character level.
 *
 * This asks only whether a threshold was authored, never whether it is met:
 * the rules engine decides that. A grant with no threshold cannot be placed on
 * the tier ladder at all, so it is skipped rather than read as level zero.
 *
 * A prepared rule holds a Predicate instance whose raw data sits on `_source`;
 * raw pack data and test fixtures hold the plain object directly.
 */
function hasLevelThreshold(rule: GrantRuleLike): boolean {
	const predicate = rule.predicate;
	if (!predicate || typeof predicate !== 'object') return false;

	const source =
		'_source' in predicate && predicate._source && typeof predicate._source === 'object'
			? predicate._source
			: predicate;

	const level = (source as { level?: { min?: unknown } }).level;
	return typeof level?.min === 'number';
}

/**
 * Derives the highest spell tier a character has unlocked from the spell
 * grants authored on their class, subclass, and feature items: the highest
 * granted tier whose level threshold the character has reached.
 *
 * Grants without a level threshold are ignored: they attach spells to a
 * character without anchoring a tier unlock to a level.
 *
 * Whether a threshold is met is decided by the rule's own predicate, through
 * the rules engine, so a grant gated on more than a level is honoured in full
 * rather than in part.
 *
 * @returns The highest unlocked tier (1-9), or 0 for a character with no
 *          eligible tiered spell grants.
 */
export function getHighestSpellTier(actor: SpellTierActorLike): number {
	let highestTier = 0;

	for (const item of actor.items?.contents ?? []) {
		if (!item.type || !TIER_GRANTING_ITEM_TYPES.has(item.type)) continue;
		if (!item.rules) continue;

		for (const rule of item.rules.values()) {
			if (rule.type !== 'grantSpells' || rule.disabled) continue;

			if (!hasLevelThreshold(rule)) continue;
			if (rule.appliesTo && !rule.appliesTo()) continue;

			const tiers = Array.isArray(rule.tiers) ? rule.tiers : [];
			for (const tier of tiers) {
				if (typeof tier === 'number' && tier > highestTier) highestTier = tier;
			}
		}
	}

	return highestTier;
}
