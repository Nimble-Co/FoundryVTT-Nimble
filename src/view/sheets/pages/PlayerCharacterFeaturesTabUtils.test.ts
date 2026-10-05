import {
	buildFeatureSections,
	FEATURE_TYPE_ORDER,
	type FeatureRowItem,
	type FeatureSection,
	sortFeatureItems,
} from './PlayerCharacterFeaturesTabUtils.js';

type TestRow = FeatureRowItem & { reactive: { _id: string } };

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
			FEATURE_TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['class']);
		expect(blockKeys(sections[0])).toEqual(['lesser-invocations', 'greater-invocations']);
	});

	it('keys each group block by its group name', () => {
		const sections = buildFeatureSections(
			[CLASS_CARD, makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 })],
			FEATURE_TYPE_ORDER,
		);

		const [block] = sectionNamed(sections, 'class').blocks;
		expect(block.kind).toBe('group');
		expect(block.key).toBe('lesser-invocations');
	});

	it('puts auto-granted features in a class features block, which renders no heading', () => {
		const sections = buildFeatureSections(
			[CLASS_CARD, makeRow('ungrouped', 'feature', { gainedAtLevel: 1 })],
			FEATURE_TYPE_ORDER,
		);

		const [block] = sectionNamed(sections, 'class').blocks;
		expect(block.kind).toBe('classFeatures');
	});

	it('keeps ungrouped and progression features together in the class features block', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('progression', 'feature', { group: 'berserker-progression', gainedAtLevel: 3 }),
			],
			FEATURE_TYPE_ORDER,
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
			FEATURE_TYPE_ORDER,
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
			FEATURE_TYPE_ORDER,
		);

		const subclassBlock = sectionNamed(sections, 'class').blocks[0];
		expect(itemIds(subclassBlock.items)).toEqual(['subclass', 'subclassFeature']);
	});

	it('renders no block for a group whose only feature the search filtered out', () => {
		const sections = buildFeatureSections(
			[CLASS_CARD, makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 })],
			FEATURE_TYPE_ORDER,
		);
		const filtered = buildFeatureSections([CLASS_CARD], FEATURE_TYPE_ORDER);

		expect(blockKeys(sections[0])).toEqual(['lesser-invocations']);
		expect(filtered[0].blocks).toEqual([]);
	});

	it('orders group blocks by the level their features first appear at', () => {
		const sections = buildFeatureSections(
			[
				CLASS_CARD,
				makeRow('greater', 'feature', { group: 'greater-invocations', gainedAtLevel: 7 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			FEATURE_TYPE_ORDER,
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
			FEATURE_TYPE_ORDER,
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
			FEATURE_TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['class', 'ancestry', 'background']);
	});

	it('nests ancestry bonuses under the ancestry card', () => {
		const sections = buildFeatureSections(
			[makeRow('ancestry', 'ancestry'), makeRow('bonus', 'ancestryBonus')],
			FEATURE_TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['ancestry']);
		expect(blockKeys(sections[0])).toEqual(['ancestryBonus']);
	});

	it('gives ancestry bonuses their own section when there is no ancestry to nest them under', () => {
		const sections = buildFeatureSections([makeRow('bonus', 'ancestryBonus')], FEATURE_TYPE_ORDER);

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
			FEATURE_TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual([
			'subclass',
			'feature',
			'lesser-invocations',
			'ancestry',
		]);
	});

	it('gives subclass features their own section when there is no class or subclass card', () => {
		const sections = buildFeatureSections(
			[makeRow('subclassFeature', 'feature', { subclass: 'reaper', gainedAtLevel: 3 })],
			FEATURE_TYPE_ORDER,
		);

		expect(sectionKeys(sections)).toEqual(['subclass']);
		expect(itemIds(sections[0].items)).toEqual(['subclassFeature']);
	});

	it('lists every feature with no class card exactly once', () => {
		const sections = buildFeatureSections(
			[
				makeRow('ancestry', 'ancestry'),
				makeRow('bonus', 'ancestryBonus'),
				makeRow('subclassFeature', 'feature', { subclass: 'reaper', gainedAtLevel: 3 }),
				makeRow('ungrouped', 'feature', { gainedAtLevel: 1 }),
				makeRow('lesser', 'feature', { group: 'lesser-invocations', gainedAtLevel: 2 }),
			],
			FEATURE_TYPE_ORDER,
		);

		expect(allItemIds(sections).sort()).toEqual([
			'ancestry',
			'bonus',
			'lesser',
			'subclassFeature',
			'ungrouped',
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
			FEATURE_TYPE_ORDER,
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
