import { isAutoGrantGroup } from '#utils/getClassFeatures.ts';

/** The prepared view of a feature-tab row that the tab's sectioning and sorting read. */
export type FeatureRowItem = {
	reactive: {
		type: string;
		sort?: number;
		system: {
			group?: string;
			subclass?: unknown;
			gainedAtLevel?: number | null;
			gainedAtLevels?: number[];
		};
	};
};

/**
 * What a top-level section is keyed by: an item type from `FEATURE_TYPE_ORDER`, or a
 * selection group standing on its own because there is no class card to nest it under.
 */
export type FeatureSectionKind = 'type' | 'group';

/**
 * A run of cards nested under a section's own cards: the features a class grants,
 * its subclass and that subclass's features, each of its selection groups, and the
 * ancestry bonuses that belong to an ancestry.
 */
export type FeatureBlockKind = 'classFeatures' | 'subclass' | 'group' | 'ancestryBonus';

export type FeatureBlock<T> = {
	/** For a `group` block, the group name the tab resolves a heading from. */
	key: string;
	kind: FeatureBlockKind;
	items: T[];
};

export type FeatureSection<T> = {
	key: string;
	kind: FeatureSectionKind;
	items: T[];
	blocks: FeatureBlock<T>[];
};

/** The item types the tab lists, in the order their sections appear. */
export const FEATURE_TYPE_ORDER = [
	'class',
	'subclass',
	'feature',
	'ancestry',
	'ancestryBonus',
	'background',
	'boon',
] as const;

/** The bucket features with no group of their own fall into, matching the class feature index. */
const UNGROUPED = 'ungrouped';

/** The type section auto-granted class features are listed under when there is no class to nest them in. */
const AUTO_GRANT_SECTION = 'feature';

/**
 * The level an item sorts at within its section. Items with no level sort last.
 *
 * Deliberately silent about a missing level. Most cards on this tab are types
 * that carry no level fields at all (a class or subclass card cannot have
 * one), and a feature that another feature's rule grants must have none:
 * level data is what makes the class progression surface an item, so adding
 * it there would offer a second copy alongside the granted one.
 *
 * Reporting either at runtime puts a message in every player's console about
 * pack data they cannot act on, once per sort. Which items should carry level
 * data is asserted by `featureLevelData.test.ts` instead, before it ships.
 */
export function getEffectiveLevel(item: FeatureRowItem): number {
	const explicit = item.reactive.system?.gainedAtLevel;
	if (explicit != null) return explicit;

	const levels = item.reactive.system?.gainedAtLevels;
	if (levels?.length) return Math.min(...levels);

	return Infinity;
}

export function sortFeatureItems<T extends FeatureRowItem>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		const levelA = getEffectiveLevel(a);
		const levelB = getEffectiveLevel(b);
		if (levelA !== levelB) return levelA - levelB;

		return (a.reactive.sort ?? 0) - (b.reactive.sort ?? 0);
	});
}

function push<T>(bucket: Map<string, T[]>, key: string, item: T): void {
	const existing = bucket.get(key) ?? [];
	existing.push(item);
	bucket.set(key, existing);
}

/**
 * The lowest level any feature in the group is gained at, which is what the
 * selection groups order by: a class offers its lesser options before its
 * greater ones, and that reads better than alphabetical order.
 */
function lowestLevel(items: FeatureRowItem[]): number {
	return Math.min(...items.map(getEffectiveLevel));
}

function groupBlocks<T extends FeatureRowItem>(byGroup: Map<string, T[]>): FeatureBlock<T>[] {
	return [...byGroup]
		.map(([key, items]) => ({
			key,
			kind: 'group' as const,
			items: sortFeatureItems(items),
		}))
		.sort((a, b) => {
			const levelA = lowestLevel(a.items);
			const levelB = lowestLevel(b.items);
			if (levelA !== levelB) return levelA - levelB;

			return a.key.localeCompare(b.key);
		});
}

/**
 * The sections the Features tab renders, in display order.
 *
 * Everything a class gives a character nests under that class: the features it
 * grants, the subclass and the subclass's own features, then each selection
 * group the class offers, under its own heading. Keeping the class as the
 * container is what will let a multiclassed character read as two separate
 * stacks rather than one merged list.
 *
 * A character with no class card still has to be able to reach those items, so
 * they fall back to top-level sections of their own. The same rule applies to
 * subclass features with no subclass card, and to ancestry bonuses with no
 * ancestry to nest under.
 */
export function buildFeatureSections<T extends FeatureRowItem>(
	items: T[],
	typeOrder: readonly string[] = FEATURE_TYPE_ORDER,
): FeatureSection<T>[] {
	const byType = new Map<string, T[]>();
	const byGroup = new Map<string, T[]>();
	const autoGranted: T[] = [];
	const subclassFeatures: T[] = [];

	for (const item of items) {
		const { type } = item.reactive;

		if (type !== 'feature') {
			push(byType, type, item);
			continue;
		}

		if (item.reactive.system.subclass) {
			subclassFeatures.push(item);
			continue;
		}

		const group = item.reactive.system.group || UNGROUPED;
		if (isAutoGrantGroup(group)) autoGranted.push(item);
		else push(byGroup, group, item);
	}

	const blocksByType = new Map<string, FeatureBlock<T>[]>();
	const hasClass = byType.has('class');

	if (hasClass) {
		const classBlocks: FeatureBlock<T>[] = [];
		const subclassCards = byType.get('subclass') ?? [];

		if (autoGranted.length) {
			classBlocks.push({
				key: AUTO_GRANT_SECTION,
				kind: 'classFeatures',
				items: sortFeatureItems(autoGranted),
			});
		}

		if (subclassCards.length || subclassFeatures.length) {
			classBlocks.push({
				key: 'subclass',
				kind: 'subclass',
				items: [...sortFeatureItems(subclassCards), ...sortFeatureItems(subclassFeatures)],
			});
		}

		classBlocks.push(...groupBlocks(byGroup));
		blocksByType.set('class', classBlocks);
		byType.delete('subclass');
	} else {
		if (autoGranted.length) byType.set(AUTO_GRANT_SECTION, autoGranted);

		// With a subclass card present the features nest under it, as they do under a class.
		// With neither card they would have nothing to attach to, so they become the section.
		if (subclassFeatures.length) {
			if (byType.has('subclass')) {
				blocksByType.set('subclass', [
					{
						key: 'subclass',
						kind: 'subclass',
						items: sortFeatureItems(subclassFeatures),
					},
				]);
			} else {
				byType.set('subclass', subclassFeatures);
			}
		}
	}

	// Ancestry bonuses normally render nested under the ancestry card. Only suppress the
	// top-level section when there is an ancestry to nest them under — otherwise deleting
	// the ancestry, or searching for the bonus by name, hides an item whose rules are
	// still applying, with no path left to edit or delete it.
	const ancestryBonuses = byType.get('ancestryBonus');
	if (byType.has('ancestry') && ancestryBonuses?.length) {
		blocksByType.set('ancestry', [
			{
				key: 'ancestryBonus',
				kind: 'ancestryBonus',
				items: sortFeatureItems(ancestryBonuses),
			},
		]);
		byType.delete('ancestryBonus');
	}

	const typeSections: FeatureSection<T>[] = [...byType]
		.map(([key, sectionItems]) => ({
			key,
			kind: 'type' as const,
			items: sortFeatureItems(sectionItems),
			blocks: blocksByType.get(key) ?? [],
		}))
		.sort((a, b) => {
			const orderA = typeOrder.indexOf(a.key);
			const orderB = typeOrder.indexOf(b.key);
			if (orderA !== orderB) return orderA - orderB;

			return a.key.localeCompare(b.key);
		});

	if (hasClass) return typeSections;

	// Without a class to nest them under, the selection groups stand on their own,
	// slotted where the class features section sits in the type order.
	const orphanGroups: FeatureSection<T>[] = groupBlocks(byGroup).map((block) => ({
		key: block.key,
		kind: 'group' as const,
		items: block.items,
		blocks: [],
	}));
	const autoGrantOrder = typeOrder.indexOf(AUTO_GRANT_SECTION);

	return [
		...typeSections.filter((section) => typeOrder.indexOf(section.key) <= autoGrantOrder),
		...orphanGroups,
		...typeSections.filter((section) => typeOrder.indexOf(section.key) > autoGrantOrder),
	];
}
