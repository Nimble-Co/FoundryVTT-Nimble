import { SYSTEM_ID } from '#system';
import localize from './localize.js';

/**
 * Purchase price of a spell scroll, keyed by the inscribed spell's tier.
 * Mirrors the table in the rulebook (Items → Spell Scrolls) and the prices
 * already carried by `packs/magicItems/core/spellScrollTemplates`.
 *
 * Tier 0 covers both cantrips and utility spells: a utility spell is
 * effectively a cantrip, so it takes the cantrip price without a special case.
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

/** Image shared by every scroll template in the magic items pack. */
const SPELL_SCROLL_IMG = 'icons/sundries/scrolls/scroll-bound-black-tan.webp';

/** Flag bag written onto a created scroll, read back when the scroll is used. */
export interface SpellScrollFlagData {
	/** UUID of the spell this scroll was inscribed from. */
	spellUuid: string;
	/** School of the inscribed spell, used for the Arcana check exemption. */
	school: string;
	/** Tier the scroll is fixed at. A scroll can never be upcast. */
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
	};
}

export interface CreateScrollFromSpellOptions {
	/**
	 * Whether to append the spell's own description beneath the scroll rules.
	 * Driven by the world setting; the rules lines are always written either way,
	 * and this never affects whether the scroll can be cast.
	 */
	includeSpellDescription: boolean;
}

/**
 * The fixed rules block every scroll carries, regardless of the description
 * setting. Kept as list items so the four facts stay scannable on the item
 * sheet rather than reading as a paragraph.
 */
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

	// Only the base effect transfers. A scroll is fixed at its inscribed tier,
	// so the spell's higher-level and upcast text can never apply.
	return `${rules}<hr>${spellDescription}`;
}

/**
 * Builds the creation data for a spell scroll inscribed with `spell`.
 *
 * Returns plain item data rather than creating the document, so the caller
 * decides where it lands and the transform stays directly testable.
 */
export default function createScrollFromSpell(
	spell: ScrollSourceSpell,
	{ includeSpellDescription }: CreateScrollFromSpellOptions,
): Record<string, unknown> {
	const tier = spell.system?.tier ?? 0;
	const school = spell.system?.school ?? '';
	const spellName = spell.name ?? localize('NIMBLE.spellScroll.unknownSpell');

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
			// A scroll casts the spell it carries, so it keeps the spell's own
			// activation — including its action cost.
			activation: foundry.utils.deepClone(spell.system?.activation ?? {}),
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
 * Lives beside the writer so the two halves of one flag format cannot drift.
 * Reads through `SYSTEM_ID` so it resolves on the dev build too, where the scope
 * key is `nimble-dev`; scrolls are created at runtime rather than shipped in a
 * pack, so the flag is always written under the running system's id.
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
