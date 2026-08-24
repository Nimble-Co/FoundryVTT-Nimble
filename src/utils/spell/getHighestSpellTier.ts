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
}

interface RuleBackedItemLike {
	type?: string;
	rules?: Map<string, GrantRuleLike>;
}

interface SpellTierActorLike {
	levels?: { character?: number };
	items?: { contents?: RuleBackedItemLike[] };
}

/**
 * A prepared rule holds a Predicate instance whose raw data sits on
 * `_source`; raw pack data and test fixtures hold the plain object directly.
 */
function getRuleMinLevel(rule: GrantRuleLike): number | null {
	const predicate = rule.predicate;
	if (!predicate || typeof predicate !== 'object') return null;

	const source =
		'_source' in predicate && predicate._source && typeof predicate._source === 'object'
			? predicate._source
			: predicate;

	const level = (source as { level?: { min?: unknown } }).level;
	const min = level?.min;
	return typeof min === 'number' ? min : null;
}

/**
 * Derives the highest spell tier a character has unlocked from the spell
 * grants authored on their class, subclass, and feature items: the highest
 * granted tier whose level threshold the character has reached.
 *
 * Grants without a level threshold are ignored — they attach spells to a
 * character without anchoring a tier unlock to a level.
 *
 * @returns The highest unlocked tier (1-9), or 0 for a character with no
 *          eligible tiered spell grants.
 */
export function getHighestSpellTier(actor: SpellTierActorLike): number {
	const characterLevel = actor.levels?.character ?? 0;
	let highestTier = 0;

	for (const item of actor.items?.contents ?? []) {
		if (!item.type || !TIER_GRANTING_ITEM_TYPES.has(item.type)) continue;
		if (!item.rules) continue;

		for (const rule of item.rules.values()) {
			if (rule.type !== 'grantSpells' || rule.disabled) continue;

			const minLevel = getRuleMinLevel(rule);
			if (minLevel === null || characterLevel < minLevel) continue;

			const tiers = Array.isArray(rule.tiers) ? rule.tiers : [];
			for (const tier of tiers) {
				if (typeof tier === 'number' && tier > highestTier) highestTier = tier;
			}
		}
	}

	return highestTier;
}
