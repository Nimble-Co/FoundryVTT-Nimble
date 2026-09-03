import { SYSTEM_ID } from '#system';
import localize from './localize.js';

/**
 * Purchase price of a spell scroll, keyed by the inscribed spell's tier.
 * Mirrors the rulebook table (Items, Spell Scrolls) and the prices already
 * carried by `packs/magicItems/core/spellScrollTemplates`.
 *
 * Tier 0 covers cantrips and utility spells alike, since a utility spell is
 * effectively a cantrip.
 */
export const SPELL_SCROLL_PRICE_BY_TIER: Readonly<Record<number, number>> = Object.freeze({
	0: 10,
	1: 35,
	2: 100,
	3: 300,
	4: 1000,
	5: 3000,
	6: 10000,
	7: 25000,
	8: 75000,
	9: 200000,
});

const SPELL_SCROLL_IMG = 'icons/sundries/scrolls/scroll-bound-black-tan.webp';

/**
 * Spell properties that still mean the same thing on a scroll and should carry
 * over when the spell is inscribed.
 *
 * `SpellDataModel` and `ObjectDataModel` both have `range` and `reach`, but those
 * fields mean weapon reach on an object and use separate min/max values, so the
 * spell's values should not transfer. `secretSpell` and `utilitySpell` describe
 * the spell's list entry rather than how it is cast, and `ObjectDataModel` has no
 * equivalent fields for them.
 */
const SCROLL_CARRIED_SPELL_PROPERTIES: ReadonlySet<string> = new Set(['concentration']);

/** Flags written onto a created scroll, read back when the scroll is used. */
export interface SpellScrollFlagData {
	spellUuid: string;
	/** Decides whether the wielder is exempt from the Arcana check. */
	school: string;
	tier: number;
}

/** The spell fields `createScrollFromSpell` reads. */
export interface ScrollSourceSpell {
	uuid?: string;
	name?: string | null;
	system?: {
		school?: string;
		tier?: number;
		description?: { baseEffect?: string };
		activation?: Record<string, unknown>;
		properties?: { selected?: string[] };
	};
}

export interface CreateScrollFromSpellOptions {
	/** The rules lines are written either way; this only adds the spell text below them. */
	includeSpellDescription: boolean;
}

function buildScrollRulesHtml(): string {
	const lines = [
		localize('NIMBLE.spellScroll.rules.singleUse'),
		localize('NIMBLE.spellScroll.rules.noManaCost'),
		localize('NIMBLE.spellScroll.rules.noMagicalAbility'),
		localize('NIMBLE.spellScroll.rules.noUpcast'),
		localize('NIMBLE.spellScroll.rules.arcanaCheck'),
	];

	return `<ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
}

function buildScrollDescription(
	spell: ScrollSourceSpell,
	includeSpellDescription: boolean,
): string {
	const rules = buildScrollRulesHtml();

	if (!includeSpellDescription) return rules;

	const spellDescription = spell.system?.description?.baseEffect ?? '';
	if (!spellDescription) return rules;

	// Only the base effect transfers, since a scroll spends no mana and so can
	// never do what the spell's upcast text describes.
	return `${rules}<hr>${spellDescription}`;
}

/**
 * Builds the creation data for a spell scroll inscribed with `spell`. Returns
 * item data rather than creating the document, so the caller decides where it
 * lands.
 *
 * Throws when the spell has no school. Every spell has one, and the school is
 * what the Arcana check exemption is decided on, so a schoolless spell is broken
 * data rather than a scroll to create.
 */
export default function createScrollFromSpell(
	spell: ScrollSourceSpell,
	{ includeSpellDescription }: CreateScrollFromSpellOptions,
): Record<string, unknown> {
	const tier = spell.system?.tier ?? 0;
	const school = spell.system?.school ?? '';
	const spellName = spell.name ?? localize('NIMBLE.spellScroll.unknownSpell');

	if (!school) {
		throw new Error(`Nimble | Cannot inscribe a scroll: the spell "${spellName}" has no school.`);
	}

	const flagData: SpellScrollFlagData = {
		spellUuid: spell.uuid ?? '',
		school,
		tier,
	};

	return {
		name: localize('NIMBLE.spellScroll.name', { spell: spellName }),
		type: 'object',
		img: SPELL_SCROLL_IMG,
		system: {
			// A scroll casts the spell as written, down to its action cost.
			activation: foundry.utils.deepClone(spell.system?.activation ?? {}),
			properties: {
				selected: (spell.system?.properties?.selected ?? []).filter((property) =>
					SCROLL_CARRIED_SPELL_PROPERTIES.has(property),
				),
			},
			description: {
				public: buildScrollDescription(spell, includeSpellDescription),
				unidentified: '',
				secret: '',
			},
			identified: true,
			objectType: 'consumable',
			quantity: 1,
			// Scrolls are small: `getUsedInventorySlots` charges one slot in total
			// for all small objects carried, not one per scroll.
			objectSizeType: 'smallSized',
			slotsRequired: 0,
			price: {
				value: SPELL_SCROLL_PRICE_BY_TIER[tier] ?? SPELL_SCROLL_PRICE_BY_TIER[0],
				denomination: 'gp',
			},
		},
		flags: {
			[SYSTEM_ID]: {
				spellScroll: flagData,
			},
		},
	};
}

/**
 * The scroll data written onto an object by {@link createScrollFromSpell}, or null
 * when the item is not an inscribed spell scroll.
 *
 * Reads through `SYSTEM_ID` so it resolves on the dev build, where the scope key
 * is `nimble-dev`. Scrolls are created at runtime rather than shipped in a pack,
 * so the flag is always written under the running system's id.
 */
export function getSpellScrollData(item: {
	type?: unknown;
	flags?: Record<string, unknown>;
}): SpellScrollFlagData | null {
	if (item.type !== 'object') return null;

	const scope = item.flags?.[SYSTEM_ID] as
		| { spellScroll?: Partial<SpellScrollFlagData> }
		| undefined;
	const scroll = scope?.spellScroll;

	if (!scroll || typeof scroll.school !== 'string' || typeof scroll.tier !== 'number') {
		return null;
	}

	return {
		spellUuid: typeof scroll.spellUuid === 'string' ? scroll.spellUuid : '',
		school: scroll.school,
		tier: scroll.tier,
	};
}
