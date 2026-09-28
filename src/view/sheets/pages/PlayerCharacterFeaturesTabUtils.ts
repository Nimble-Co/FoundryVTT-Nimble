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
 * A section heading on the tab, either an item type from `typeOrder` or a class
 * feature group named by the features themselves.
 */
export type FeatureSectionKind = 'type' | 'group';

export type FeatureSection<T> = {
	key: string;
	kind: FeatureSectionKind;
	items: T[];
};

/** The bucket features with no group of their own fall into, matching the class feature index. */
const UNGROUPED = 'ungrouped';

/** The type section auto-granted class features are listed under. */
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

/** Turns a kebab-case group name into a heading, so `lesser-invocations` reads as Lesser Invocations. */
export function formatGroupName(name: string): string {
	return name
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function addToSection<T>(sections: Map<string, T[]>, key: string, item: T): void {
	const section = sections.get(key) ?? [];
	section.push(item);
	sections.set(key, section);
}

/**
 * The lowest level any feature in the section is gained at, which is what the
 * selection groups order by: a class offers its lesser options before its
 * greater ones, and that reads better than alphabetical order.
 */
function lowestLevel(items: FeatureRowItem[]): number {
	return Math.min(...items.map(getEffectiveLevel));
}

/**
 * The sections the Features tab renders, in display order.
 *
 * Item types keep the order given by `typeOrder`. Class feature groups become
 * sections of their own, named by the group, and follow the auto-granted class
 * features they sit alongside. Subclass features and ancestry bonuses are left
 * out: those render nested under their parent card.
 */
export function buildFeatureSections<T extends FeatureRowItem>(
	items: T[],
	typeOrder: readonly string[],
): FeatureSection<T>[] {
	const byType = new Map<string, T[]>();
	const byGroup = new Map<string, T[]>();

	for (const item of items) {
		const { type } = item.reactive;

		if (type !== 'feature') {
			addToSection(byType, type, item);
			continue;
		}

		if (item.reactive.system.subclass) continue;

		const group = item.reactive.system.group || UNGROUPED;
		if (isAutoGrantGroup(group)) addToSection(byType, AUTO_GRANT_SECTION, item);
		else addToSection(byGroup, group, item);
	}

	// Ancestry bonuses normally render nested under the ancestry card. Only suppress the
	// top-level section when there is an ancestry to nest them under — otherwise deleting
	// the ancestry, or searching for the bonus by name, hides an item whose rules are
	// still applying, with no path left to edit or delete it.
	if (byType.has('ancestry')) byType.delete('ancestryBonus');

	const typeSections: FeatureSection<T>[] = [...byType]
		.map(([key, sectionItems]) => ({ key, kind: 'type' as const, items: sectionItems }))
		.sort((a, b) => {
			const orderA = typeOrder.indexOf(a.key);
			const orderB = typeOrder.indexOf(b.key);
			if (orderA !== orderB) return orderA - orderB;

			return a.key.localeCompare(b.key);
		});

	const groupSections: FeatureSection<T>[] = [...byGroup]
		.map(([key, sectionItems]) => ({ key, kind: 'group' as const, items: sectionItems }))
		.sort((a, b) => {
			const levelA = lowestLevel(a.items);
			const levelB = lowestLevel(b.items);
			if (levelA !== levelB) return levelA - levelB;

			return a.key.localeCompare(b.key);
		});

	const autoGrantOrder = typeOrder.indexOf(AUTO_GRANT_SECTION);

	return [
		...typeSections.filter((section) => typeOrder.indexOf(section.key) <= autoGrantOrder),
		...groupSections,
		...typeSections.filter((section) => typeOrder.indexOf(section.key) > autoGrantOrder),
	];
}
