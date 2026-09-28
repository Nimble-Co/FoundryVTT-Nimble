import { describe, expect, it } from 'vitest';

import {
	buildFeatureSections,
	type FeatureRowItem,
	type FeatureSection,
	formatGroupName,
	sortFeatureItems,
} from './PlayerCharacterFeaturesTabUtils.js';

type TestRow = FeatureRowItem & { reactive: { _id: string } };

// Mirrors the tab's own list, whose order drives type section placement.
const TYPE_ORDER = [
	'class',
	'subclass',
	'feature',
	'ancestry',
	'ancestryBonus',
	'background',
	'boon',
] as const;

function makeRow(
	_id: string,
	type: string,
	system: Partial<FeatureRowItem['reactive']['system']> = {},
	sort = 0,
): TestRow {
	return { reactive: { _id, type, sort, system } };
}

function sectionKeys(sections: FeatureSection<TestRow>[]): string[] {
	return sections.map((section) => section.key);
}

function itemIds(items: TestRow[]): string[] {
	return items.map((item) => item.reactive._id);
}

describe('buildFeatureSections', () => {
	it('gives each named feature group its own section', () => {
		const sections = buildFeatureSections(
			[
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
				makeRow('greater', 'feature', { group: 'greater-invocations', gainedAtLevel: 7 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['lesser-invocations', 'greater-invocations']);
	});

	it('keeps ungrouped and progression features together under the class features section', () => {
		const sections = buildFeatureSections(
			[
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('progression', 'feature', { group: 'berserker-progression', gainedAtLevel: 3 }),
			],
			TYPE_ORDER,
		);

		expect(sections).toHaveLength(1);
		expect(sections[0].key).toBe('feature');
		expect(itemIds(sections[0].items)).toEqual(['ungrouped', 'progression']);
	});

	it('renders no section for a group with no features', () => {
		const sections = buildFeatureSections([makeRow('class', 'class')], TYPE_ORDER);

		expect(sectionKeys(sections)).toEqual(['class']);
	});

	it('orders group sections by the level their features first appear at', () => {
		const sections = buildFeatureSections(
			[
				makeRow('greater', 'feature', { group: 'greater-invocations', gainedAtLevel: 7 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['lesser-invocations', 'greater-invocations']);
	});

	it('orders groups sharing a first level by group name', () => {
		const sections = buildFeatureSections(
			[
				makeRow('b', 'feature', { group: 'war-cries', gainedAtLevel: 2 }),
				makeRow('a', 'feature', { group: 'savage-arsenal', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['savage-arsenal', 'war-cries']);
	});

	it('places group sections after class features and before ancestry', () => {
		const sections = buildFeatureSections(
			[
				makeRow('background', 'background'),
				makeRow('ancestry', 'ancestry'),
				makeRow('class', 'class'),
				makeRow('subclass', 'subclass'),
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual([
			'class',
			'subclass',
			'feature',
			'lesser-invocations',
			'ancestry',
			'background',
		]);
	});

	it('places group sections at the class features slot when there are no class features', () => {
		const sections = buildFeatureSections(
			[
				makeRow('ancestry', 'ancestry'),
				makeRow('class', 'class'),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['class', 'lesser-invocations', 'ancestry']);
	});

	it('leaves subclass features out of every section so they stay nested under the subclass card', () => {
		const sections = buildFeatureSections(
			[
				makeRow('subclass', 'subclass'),
				makeRow('subclassFeature', 'feature', { subclass: 'reaper', gainedAtLevel: 3 }),
				makeRow('groupedSubclassFeature', 'feature', {
					subclass: 'reaper',
					group: 'lesser-invocations',
					gainedAtLevel: 3,
				}),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['subclass']);
	});

	it('drops the ancestry bonus section only when an ancestry is there to nest it under', () => {
		const withAncestry = buildFeatureSections(
			[makeRow('ancestry', 'ancestry'), makeRow('bonus', 'ancestryBonus')],
			TYPE_ORDER,
		);
		const withoutAncestry = buildFeatureSections([makeRow('bonus', 'ancestryBonus')], TYPE_ORDER);

		expect(sectionKeys(withAncestry)).toEqual(['ancestry']);
		expect(sectionKeys(withoutAncestry)).toEqual(['ancestryBonus']);
	});

	it('lists every non-subclass feature exactly once', () => {
		const sections = buildFeatureSections(
			[
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('progression', 'feature', { group: 'mage-progression', gainedAtLevel: 2 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
				makeRow('greater', 'feature', { group: 'greater-invocations', gainedAtLevel: 7 }),
			],
			TYPE_ORDER,
		);

		expect(sections.flatMap((section) => itemIds(section.items)).sort()).toEqual([
			'greater',
			'lesser',
			'progression',
			'ungrouped',
		]);
	});
});

describe('sortFeatureItems', () => {
	it('sorts by level, with unlevelled features last', () => {
		const sorted = sortFeatureItems([
			makeRow('none', 'feature'),
			makeRow('seven', 'feature', { gainedAtLevel: 7 }),
			makeRow('earliestOfMany', 'feature', { gainedAtLevels: [5, 9] }),
			makeRow('two', 'feature', { gainedAtLevel: 2 }),
		]);

		expect(itemIds(sorted)).toEqual(['two', 'earliestOfMany', 'seven', 'none']);
	});

	it('falls back to the item sort order within a level', () => {
		const sorted = sortFeatureItems([
			makeRow('second', 'feature', { gainedAtLevel: 2 }, 200),
			makeRow('first', 'feature', { gainedAtLevel: 2 }, 100),
		]);

		expect(itemIds(sorted)).toEqual(['first', 'second']);
	});
});

describe('formatGroupName', () => {
	it('reads a kebab-case group name as a heading', () => {
		expect(formatGroupName('lesser-invocations')).toBe('Lesser Invocations');
	});
});
