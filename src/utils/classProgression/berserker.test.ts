import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildRealIndex,
	getClassMeta,
	type LevelSummary,
	restoreMocks,
	simulateProgression,
} from '../../../tests/fixtures/classProgression.ts';
import type { ClassFeatureIndex } from '../getClassFeatures.ts';

/**
 * Integration test for the Berserker class progression.
 *
 * Expectations mirror the human-facing test report for this class and are inlined
 * here so the test stays self-contained. The test drives the REAL feature resolver
 * via the shared harness and asserts the resolver grants exactly what the report
 * claims across character creation (level 1) and leveling 2 -> 20.
 */

const CLASS_ID = 'berserker';

interface ReportPool {
	group: string;
	options: string[];
}

interface ReportLevel {
	level: number;
	auto: string[];
	pools: ReportPool[];
	subclass: ReportPool[];
	asi: string | null;
}

interface Report {
	name: string;
	id: string;
	hitDie: number;
	startingHp: number;
	keyAbilities: string[];
	savingThrows: { adv: string; dis: string };
	startingGear: string[];
	caster: boolean;
	manaFormula: string;
	subclasses: string[];
	subclassSelectLevel: number;
	levels: ReportLevel[];
}

// Inlined report spec (the report's claim for Berserker).
const REPORT: Report = {
	name: 'Berserker',
	id: 'berserker',
	hitDie: 12,
	startingHp: 20,
	keyAbilities: ['STR', 'DEX'],
	savingThrows: { adv: 'STR', dis: 'INT' },
	startingGear: ['Battle Axe', 'Rope'],
	caster: false,
	manaFormula: '',
	subclasses: ['Path Of The Mountainheart', 'Path Of The Red Mist'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Rage', 'That all you got?!'], pools: [], subclass: [], asi: null },
		{
			level: 2,
			auto: ['Intensifying Fury', 'One with the Ancients'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Bloodlust'],
			pools: [],
			subclass: [
				{
					group: 'Path Of The Mountainheart',
					options: ['Mountainous Tenacity', "Stone's Resilience"],
				},
				{ group: 'Path Of The Red Mist', options: ['Blood Frenzy', 'Savage Awareness'] },
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Enduring Rage', 'Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 5, auto: ['Rage'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 6,
			auto: ['Intensifying Fury', 'Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Path Of The Mountainheart', options: ['Unbreakable'] },
				{ group: 'Path Of The Red Mist', options: ['Unstoppable Brutality'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 9, auto: ['Intensifying Fury'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 10,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Path Of The Mountainheart', options: ["Titan's Fury"] },
				{ group: 'Path Of The Red Mist', options: ['Opportunistic Frenzy'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Intensifying Fury'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Path Of The Mountainheart', options: ["Mountain's Endurance"] },
				{ group: 'Path Of The Red Mist', options: ['Onslaught'] },
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Savage Arsenal'],
			pools: [{ group: 'Savage Arsenal', options: SAVAGE_ARSENAL_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 17, auto: ['Intensifying Fury'], pools: [], subclass: [], asi: 'secondary' },
		{ level: 18, auto: ['DEEP RAGE'], pools: [], subclass: [], asi: null },
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['BOUNDLESS RAGE'], pools: [], subclass: [], asi: 'capstone' },
	],
};

function SAVAGE_ARSENAL_OPTIONS(): string[] {
	return [
		'Death Blow',
		'Deathless Rage',
		'Eager for Battle',
		'Into the Fray',
		'Mighty Endurance',
		'MORE BLOOD!',
		'Rampage',
		'Swift Fury',
		'Thunderous Steps',
		'Unstoppable Force',
		'Whirlwind',
		"You're Next!",
	];
}

/** Slugify a report display group name into the resolver's group identifier. */
function slug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Full ability-name -> abbreviation map used by the class definition. */
const ABILITY_ABBR: Record<string, string> = {
	strength: 'STR',
	dexterity: 'DEX',
	constitution: 'CON',
	intelligence: 'INT',
	wisdom: 'WIS',
	charisma: 'CHA',
};

let index: ClassFeatureIndex;
let summaries: LevelSummary[];

beforeAll(async () => {
	index = await buildRealIndex();
	summaries = await simulateProgression(index, CLASS_ID);
});

afterAll(() => {
	restoreMocks();
});

describe('Berserker character creation (level 1)', () => {
	it('has the reported hit die and starting HP', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.hitDieSize).toBe(REPORT.hitDie);
		expect(meta.startingHp).toBe(REPORT.startingHp);
	});

	it('has the reported key abilities', () => {
		const meta = getClassMeta(CLASS_ID);
		const abbrs = meta.keyAbilityScores.map((a) => ABILITY_ABBR[a] ?? a);
		expect(abbrs).toEqual(REPORT.keyAbilities);
	});

	it('has the reported saving throws', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(ABILITY_ABBR[meta.savingThrows.advantage]).toBe(REPORT.savingThrows.adv);
		expect(ABILITY_ABBR[meta.savingThrows.disadvantage]).toBe(REPORT.savingThrows.dis);
	});

	it('grants the reported starting gear', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.startingGear).toEqual(REPORT.startingGear);
	});

	it('is a non-caster with no mana formula', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.caster).toBe(REPORT.caster);
		expect(meta.manaFormula).toBe(REPORT.manaFormula);
	});

	it('auto-grants exactly the reported level 1 features', () => {
		const l1 = summaries[0];
		const granted = new Set([...l1.newAutoGrants, ...l1.optionFeatureNames]);
		expect([...granted].sort()).toEqual([...REPORT.levels[0].auto].sort());
	});
});

describe('Berserker subclass configuration', () => {
	it('selects a subclass at the reported level', () => {
		expect(getClassMeta(CLASS_ID).subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
	});

	it('exposes exactly the reported number of subclasses', () => {
		expect(getClassMeta(CLASS_ID).subclassGroups.length).toBe(REPORT.subclasses.length);
	});
});

describe('Berserker integrity invariants', () => {
	it('produces exactly 20 level summaries', () => {
		expect(summaries).toHaveLength(20);
		summaries.forEach((s, i) => {
			expect(s.level).toBe(i + 1);
		});
	});

	it('never auto-grants the same feature at more than one level', () => {
		const counts = new Map<string, number>();
		for (const s of summaries) {
			for (const name of s.newAutoGrants) counts.set(name, (counts.get(name) ?? 0) + 1);
		}
		const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
		expect(duplicated).toEqual([]);
	});

	it('offers no pool with fewer options than required picks', () => {
		for (const s of summaries) {
			for (const [group, pool] of Object.entries(s.offeredGroups)) {
				expect(pool.selectionCount, `${group} @ L${s.level} selectionCount`).toBeGreaterThanOrEqual(
					1,
				);
				expect(
					pool.options.length,
					`${group} @ L${s.level} options vs count`,
				).toBeGreaterThanOrEqual(pool.selectionCount);
			}
		}
	});
});

describe('Berserker auto-grant union across all levels', () => {
	it('grants (auto or via option picker) exactly the reported set of features', () => {
		const actual = new Set<string>();
		for (const s of summaries) {
			for (const name of s.newAutoGrants) actual.add(name);
			for (const name of s.optionFeatureNames) actual.add(name);
		}
		const expected = new Set<string>();
		for (const lvl of REPORT.levels) for (const name of lvl.auto) expected.add(name);
		expect([...actual].sort()).toEqual([...expected].sort());
	});
});

describe('Berserker ASI schedule', () => {
	it('matches the reported ability-score-increase schedule level by level', () => {
		const actual = summaries.map((s) => ({ level: s.level, asi: s.asi }));
		const expected = REPORT.levels.map((l) => ({ level: l.level, asi: l.asi }));
		expect(actual).toEqual(expected);
	});
});

describe('Berserker selection pools per level', () => {
	for (const reportLevel of REPORT.levels) {
		const { level } = reportLevel;

		it(`offers the reported pool groups at level ${level}`, () => {
			const summary = summaries[level - 1];
			const expectedGroups = reportLevel.pools.map((p) => slug(p.group)).sort();
			const actualGroups = Object.keys(summary.offeredGroups).sort();
			expect(actualGroups).toEqual(expectedGroups);
		});

		// Levels whose report auto feature is itself an option-driven pool (#708):
		// the feature name (slugified) matches one of the level's pool groups.
		const optionDriven = reportLevel.auto.filter((name) =>
			reportLevel.pools.some((p) => slug(p.group) === slug(name)),
		);
		if (optionDriven.length > 0) {
			it(`surfaces option feature(s) ${optionDriven.join(', ')} at level ${level}`, () => {
				const summary = summaries[level - 1];
				expect([...summary.optionFeatureNames].sort()).toEqual([...optionDriven].sort());
			});
		}
	}

	it('offers the full Savage Arsenal option list when it is first unlocked (level 4)', () => {
		const summary = summaries[3];
		const pool = summary.offeredGroups[slug('Savage Arsenal')];
		expect(pool).toBeDefined();
		expect(pool.selectionCount).toBe(1);
		expect([...pool.options].sort()).toEqual([...SAVAGE_ARSENAL_OPTIONS()].sort());
	});
});
