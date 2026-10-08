import type { NimbleFeatureItem } from '../../src/documents/item/feature.js';
import type { OptionSwapSource } from '../../src/utils/resolveOptionSwapOffer.ts';
import type {
	ResolvedOptionSwapOffer,
	ResolvedSwappableOptionPool,
} from '../../types/optionSwap.d.ts';

/**
 * Fixtures for the option swap section: pools that stand in for what a class grants, and the
 * features whose rules make the offer.
 */
export function createSwapFeature(
	uuid: string,
	name: string,
	group = '',
	description = '',
): NimbleFeatureItem {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		system: { description, group },
	} as NimbleFeatureItem;
}

export const ARSENAL = [
	createSwapFeature('Item.cleave', 'Cleave', 'savage-arsenal', '<p>Hit them all.</p>'),
	createSwapFeature('Item.rampage', 'Rampage', 'savage-arsenal'),
	createSwapFeature('Item.savage-leap', 'Savage Leap', 'savage-arsenal'),
];

export const MAGE_OPTIONS = [
	createSwapFeature('Compendium.focus', 'Focus', 'mage-options'),
	createSwapFeature('Compendium.insight', 'Insight', 'mage-options'),
	createSwapFeature('Compendium.study', 'Study!', 'mage-options'),
];

export function createPool(
	overrides: Partial<ResolvedSwappableOptionPool> = {},
): ResolvedSwappableOptionPool {
	const heldCount = overrides.heldCount ?? 1;
	return {
		poolKey: 'savage-arsenal',
		poolGroups: ['savage-arsenal'],
		displayName: 'Savage Arsenal',
		optionLabel: 'Choose a Savage Arsenal Ability',
		levels: [3],
		heldCount,
		// The levels grant what the character holds unless a case says otherwise.
		grantedCount: heldCount,
		slots: [],
		candidateUuids: ARSENAL.map((feature) => feature.uuid as string),
		heldIdsByUuid: new Map([['Item.cleave', ['abc123']]]),
		repeatableUuids: [],
		candidates: ARSENAL,
		...overrides,
	};
}

/** A one-pick pool holding the feature that offers the swap, by the item id it was granted. */
export function createMagePool(heldId = 'i-focus') {
	return createPool({
		poolKey: 'mage-options',
		poolGroups: ['mage-options'],
		displayName: 'Mage Options',
		heldCount: 1,
		grantedCount: 1,
		candidateUuids: MAGE_OPTIONS.map((feature) => feature.uuid as string),
		heldIdsByUuid: new Map([['Compendium.focus', [heldId]]]),
		candidates: MAGE_OPTIONS,
	});
}

export const TACTICS = [
	createSwapFeature('Item.heavy-strike', 'Heavy Strike', 'combat-tactics'),
	createSwapFeature('Item.sweeping-strike', 'Sweeping Strike', 'combat-tactics'),
	createSwapFeature('Item.max-die', '+1 Max Combat Die', 'combat-tactics'),
];

/** A pool holding one tactic and a repeatable member twice, three picks in all. */
export function createDiePool(
	overrides: Partial<ResolvedSwappableOptionPool> = {},
): ResolvedSwappableOptionPool {
	return createPool({
		poolKey: 'combat-tactics',
		poolGroups: ['combat-tactics'],
		displayName: 'Fit for Any Battlefield',
		optionLabel: null,
		levels: [4, 6, 8],
		heldCount: 3,
		candidateUuids: TACTICS.map((feature) => feature.uuid as string),
		heldIdsByUuid: new Map([
			['Item.heavy-strike', ['t4']],
			['Item.max-die', ['d6', 'd8']],
		]),
		repeatableUuids: ['Item.max-die'],
		candidates: TACTICS,
		...overrides,
	});
}

export function createSwapSource(overrides: Partial<OptionSwapSource> = {}): OptionSwapSource {
	return {
		name: 'Wrath & Ruin',
		text: 'Whenever you perform a notable act of destruction during a Safe Rest, you may choose different Berserker options available to you.',
		uuid: 'Actor.hero.Item.wrath',
		img: 'icons/svg/book.svg',
		coversAllGroups: true,
		groups: [],
		skillPoints: 0,
		...overrides,
	};
}

export function createOffer(
	overrides: Partial<ResolvedOptionSwapOffer> = {},
): ResolvedOptionSwapOffer {
	return {
		allowedGroups: null,
		skillPoints: 0,
		sources: [createSwapSource()],
		pools: [createPool()],
		...overrides,
	};
}

/**
 * A pool whose members come from two option lists, plus one option a level grants outright
 * from a list of its own. The extra may be taken more than once.
 */
export const FIELD_COMMAND = [
	createSwapFeature('Item.rally', 'Rally', 'field-signals'),
	createSwapFeature('Item.regroup', 'Regroup', 'field-signals'),
	createSwapFeature('Item.feint', 'Feint', 'field-maneuvers'),
	createSwapFeature('Item.flank', 'Flank', 'field-maneuvers'),
	createSwapFeature('Item.extra-die', '+1 Extra Die', 'sample-progression'),
];

/** A pool spanning two groups, holding one member of each and the extra. */
export function createSpanningPool(
	overrides: Partial<ResolvedSwappableOptionPool> = {},
): ResolvedSwappableOptionPool {
	return createPool({
		poolKey: 'field-command',
		poolGroups: ['field-signals', 'field-maneuvers'],
		displayName: 'Field Command',
		optionLabel: null,
		levels: [2, 4, 6],
		heldCount: 3,
		candidateUuids: FIELD_COMMAND.map((feature) => feature.uuid as string),
		heldIdsByUuid: new Map([
			['Item.rally', ['s2']],
			['Item.feint', ['m4']],
			['Item.extra-die', ['x6']],
		]),
		repeatableUuids: ['Item.extra-die'],
		candidates: FIELD_COMMAND,
		...overrides,
	});
}
