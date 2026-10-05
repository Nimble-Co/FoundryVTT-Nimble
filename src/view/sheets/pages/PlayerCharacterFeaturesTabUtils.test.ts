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

function sectionNamed(sections: FeatureSection<TestRow>[], key: string): FeatureSection<TestRow> {
	const section = sections.find((candidate) => candidate.key === key);
	if (!section) throw new Error(`no ${key} section`);

	return section;
}

function blockKeys(section: FeatureSection<TestRow>): string[] {
	return section.blocks.map((block) => block.key);
}

function allItemIds(sections: FeatureSection<TestRow>[]): string[] {
	return sections.flatMap((section) => [
		...itemIds(section.items),
		...section.blocks.flatMap((block) => itemIds(block.items)),
	]);
}

const CLASS_CARD = makeRow('class', 'class');

describe('buildFeatureSections', () => {
	it('nests each named feature group under the class it came from', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
				makeRow('greater', 'feature', { group: 'greater-invocations', gainedAtLevel: 7 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['class']);
		expect(blockKeys(sections[0])).toEqual(['lesser-invocations', 'greater-invocations']);
	});

	it('labels each group block with its group name', () => {
		const sections = buildFeatureSections(
			[CLASS_CARD, makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 })],
			TYPE_ORDER,
		);

		expect(sectionNamed(sections, 'class').blocks[0].label).toBe('Lesser Invocations');
	});

	it('leaves the auto-granted block unlabelled so it reads as part of the class card', () => {
		const sections = buildFeatureSections(
			[CLASS_CARD, makeRow('ungrouped', 'feature', { gainedAtLevel: 1 })],
			TYPE_ORDER,
		);

		const [block] = sectionNamed(sections, 'class').blocks;
		expect(block.kind).toBe('classFeatures');
		expect(block.label).toBeNull();
	});

	it('keeps ungrouped and progression features together in the class features block', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('progression', 'feature', { group: 'berserker-progression', gainedAtLevel: 3 }),
			],
			TYPE_ORDER,
		);

		const [block] = sectionNamed(sections, 'class').blocks;
		expect(itemIds(block.items)).toEqual(['ungrouped', 'progression']);
	});

	it('orders the class blocks as features, then subclass, then groups', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('subclass', 'subclass'),
				makeRow('subclassFeature', 'feature', { subclass: 'reaper', gainedAtLevel: 3 }),
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['class']);
		expect(blockKeys(sections[0])).toEqual(['feature', 'subclass', 'lesser-invocations']);
	});

	it('puts the subclass card above its own features', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('subclassFeature', 'feature', { subclass: 'reaper', gainedAtLevel: 3 }),
				makeRow('subclass', 'subclass'),
			],
			TYPE_ORDER,
		);

		const subclassBlock = sectionNamed(sections, 'class').blocks[0];
		expect(itemIds(subclassBlock.items)).toEqual(['subclass', 'subclassFeature']);
	});

	it('renders no block for a group with no features', () => {
		const sections = buildFeatureSections([CLASS_CARD], TYPE_ORDER);

		expect(sectionKeys(sections)).toEqual(['class']);
		expect(sections[0].blocks).toEqual([]);
	});

	it('orders group blocks by the level their features first appear at', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('greater', 'feature', { group: 'greater-invocations', gainedAtLevel: 7 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(blockKeys(sections[0])).toEqual(['lesser-invocations', 'greater-invocations']);
	});

	it('orders groups sharing a first level by group name', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('b', 'feature', { group: 'war-cries', gainedAtLevel: 2 }),
				makeRow('a', 'feature', { group: 'savage-arsenal', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(blockKeys(sections[0])).toEqual(['savage-arsenal', 'war-cries']);
	});

	it('keeps ancestry and background as their own sections beneath the class', () => {
		const sections = buildFeatureSections(
			[
				makeRow('background', 'background'),
				makeRow('ancestry', 'ancestry'),
				CLASS_CARD,
				makeRow('subclass', 'subclass'),
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['class', 'ancestry', 'background']);
	});

	it('nests ancestry bonuses under the ancestry card', () => {
		const sections = buildFeatureSections(
			[makeRow('ancestry', 'ancestry'), makeRow('bonus', 'ancestryBonus')],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['ancestry']);
		expect(blockKeys(sections[0])).toEqual(['ancestryBonus']);
	});

	it('gives ancestry bonuses their own section when there is no ancestry to nest them under', () => {
		const sections = buildFeatureSections([makeRow('bonus', 'ancestryBonus')], TYPE_ORDER);

		expect(sectionKeys(sections)).toEqual(['ancestryBonus']);
	});

	it('falls back to top-level sections when there is no class to nest under', () => {
		const sections = buildFeatureSections(
			[
				makeRow('ancestry', 'ancestry'),
				makeRow('subclass', 'subclass'),
				makeRow('subclassFeature', 'feature', { subclass: 'reaper', gainedAtLevel: 3 }),
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual([
			'subclass',
			'feature',
			'lesser-invocations',
			'ancestry',
		]);
	});

	it('lists every feature exactly once', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('subclass', 'subclass'),
				makeRow('subclassFeature', 'feature', { subclass: 'reaper', gainedAtLevel: 3 }),
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('progression', 'feature', { group: 'mage-progression', gainedAtLevel: 2 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
				makeRow('greater', 'feature', { group: 'greater-invocations', gainedAtLevel: 7 }),
			],
			TYPE_ORDER,
		);

		expect(allItemIds(sections).sort()).toEqual([
			'class',
			'greater',
			'lesser',
			'progression',
			'subclass',
			'subclassFeature',
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
