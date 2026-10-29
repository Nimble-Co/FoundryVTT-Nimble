import { isUtilitySpell, spellSchool, spellTier } from './itemFields.ts';
import type { ItemLike } from './sheetSource.ts';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** A to Z by name. Spec 6.2: the order of Inventory, Actions, Reactions and Effects. */
export function byName<T extends { name: string }>(entries: T[]): T[] {
	return [...entries].sort((a, b) => collator.compare(a.name, b.name));
}

/** By tier: tier 0 holds the cantrips and the utility spells. A to Z in each tier. */
export function spellsByTier(spells: ItemLike[]): { tier: number; spells: ItemLike[] }[] {
	const tiers = new Map<number, ItemLike[]>();
	for (const spell of spells) {
		const tier = isUtilitySpell(spell) ? 0 : spellTier(spell);
		tiers.set(tier, [...(tiers.get(tier) ?? []), spell]);
	}
	return [...tiers.entries()]
		.sort(([a], [b]) => a - b)
		.map(([tier, entries]) => ({ tier, spells: byName(entries) }));
}

/** After every tier, so the utility spells of a school come last. */
const UTILITY_RANK = 10;

const rankInSchool = (spell: ItemLike) => (isUtilitySpell(spell) ? UTILITY_RANK : spellTier(spell));

/** By school: the schools A to Z; in a school the cantrips, then each tier, then the utility spells, A to Z in each. */
export function spellsBySchool(spells: ItemLike[]): { school: string; spells: ItemLike[] }[] {
	const schools = new Map<string, ItemLike[]>();
	for (const spell of spells) {
		const school = spellSchool(spell);
		schools.set(school, [...(schools.get(school) ?? []), spell]);
	}
	return [...schools.entries()]
		.sort(([a], [b]) => collator.compare(a, b))
		.map(([school, entries]) => ({
			school,
			spells: byName(entries).sort((a, b) => rankInSchool(a) - rankInSchool(b)),
		}));
}
