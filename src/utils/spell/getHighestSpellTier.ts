import { Predicate } from '../../etc/Predicate.js';
import { isPlainObject } from '../isPlainObject.js';

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
 * The threshold may sit at the top level or inside any `$and` / `$or` branch,
 * the only logical operators the predicate schema defines. Whether the branch
 * that holds it is the one that applies is again left to the rules engine.
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

	return containsLevelMin(source);
}

function containsLevelMin(raw: object): boolean {
	const level = (raw as { level?: { min?: unknown } }).level;
	if (typeof level?.min === 'number') return true;

	for (const [key, value] of Object.entries(raw)) {
		if (!Predicate.isLogicalKey(key) || !Array.isArray(value)) continue;
		if (value.some((item) => isPlainObject(item) && containsLevelMin(item))) return true;
	}

	return false;
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
				// Spell tiers run 0 to 9; anything else is bad authoring, not a tier.
				if (!Number.isInteger(tier) || tier < 0 || tier > 9) continue;
				if (tier > highestTier) highestTier = tier;
			}
		}
	}

	return highestTier;
}
