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

/**
 * Spell properties that keep their meaning on the scroll object, and so transfer
 * when a spell is inscribed.
 *
 * `SpellDataModel` and `ObjectDataModel` also share `range` and `reach`, but on an
 * object those are weapon reach backed by their own min/max fields, not the
 * spell's range — so they stay behind. `secretSpell` and `utilitySpell` describe
 * the spell list entry rather than the casting, and `ObjectDataModel` has no
 * matching option for either.
 */
const SCROLL_CARRIED_SPELL_PROPERTIES: ReadonlySet<string> = new Set(['concentration']);

/** Flag bag written onto a created scroll, read back when the scroll is used. */
export interface SpellScrollFlagData {
	/** UUID of the spell this scroll was inscribed from. */
	spellUuid: string;
	/** School of the inscribed spell, used for the Arcana check exemption. */
	school: string;
	/** Tier the scroll was inscribed at, which is the only tier it can be cast at. */
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

	// Only the base effect transfers. A scroll spends no mana, so the spell's
	// upcast text describes something the scroll can never do.
	return `${rules}<hr>${spellDescription}`;
}

/**
 * Builds the creation data for a spell scroll inscribed with `spell`.
 *
 * Returns plain item data rather than creating the document, so the caller
 * decides where it lands and the transform stays directly testable.
 *
 * Throws when the spell carries no school. Every spell has one, and the school
 * is what the Arcana check's exemption is decided on, so a schoolless spell is
 * broken data rather than a case to inscribe a half-working scroll for.
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
			// A scroll casts the spell it carries, so it keeps the spell's own
			// activation — including its action cost.
			activation: foundry.utils.deepClone(spell.system?.activation ?? {}),
			// And the spell's own constraints: a concentration spell cast off a
			// scroll still demands concentration. `ObjectDataModel` only accepts the
			// properties it defines, so anything spell-only is dropped on the way in.
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
