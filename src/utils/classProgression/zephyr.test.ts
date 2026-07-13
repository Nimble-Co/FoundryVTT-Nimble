import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildRealIndex,
	getClassMeta,
	restoreMocks,
	simulateProgression,
} from '../../../tests/fixtures/classProgression.ts';
import type { LevelSummary } from '../../../tests/fixtures/classProgression.types.ts';
import type { ClassFeatureIndex } from '../getClassFeatures.ts';

/**
 * Integration test for the Zephyr class progression.
 *
 * Expectations mirror the human-facing test report for this class and are inlined
 * here so the test stays self-contained. The test drives the REAL feature resolver
 * via the shared harness and asserts the resolver grants exactly what the report
 * claims across character creation (level 1) and leveling 2 -> 20.
 *
 * Zephyr's signature #708 feature is "Martial Arts Ability": a recurring option
 * feature (levels 4/6/8/10/12/14/16/18) that presents the `martial-arts-ability`
 * selection pool each time. Level 17 is reported as ASI-only (no feature grants).
 */

const CLASS_ID = 'zephyr';

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

function MARTIAL_ARTS_ABILITY_OPTIONS(): string[] {
	return [
		'Airshift',
		'Blur',
		'Bodily Discipline',
		'Enduring Soul',
		'I Jump On His Back!',
		'Kinetic Barrage',
		'Mighty Soul',
		'Quickstrike',
		'Use Momentum',
		'Vital Rejuvenation',
		'Windstrider',
	];
}

function MARTIAL_ARTS_POOL(): ReportPool {
	return { group: 'Martial Arts Ability', options: MARTIAL_ARTS_ABILITY_OPTIONS() };
}

// Inlined report spec (the report's claim for Zephyr).
const REPORT: Report = {
	name: 'Zephyr',
	id: 'zephyr',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['STR', 'DEX'],
	savingThrows: { adv: 'DEX', dis: 'INT' },
	startingGear: ['Staff', 'Traveling Robes & Sandals'],
	caster: false,
	manaFormula: '',
	subclasses: ['Way Of Flame', 'Way Of Pain'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Iron Defense', 'Swift Fists'], pools: [], subclass: [], asi: null },
		{ level: 2, auto: ['Burst of Speed', 'Swift Feet'], pools: [], subclass: [], asi: null },
		{
			level: 3,
			auto: ['Ethereal Projection', 'Kinetic Momentum'],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Exploding Soul'] },
				{ group: 'Way Of Pain', options: ['Bring the Pain'] },
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Martial Arts Ability', 'Unyielding Resolve'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 5, auto: ['Reverberating Strikes'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 6,
			auto: ['Infuse Strength', 'Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Blazing Speed'] },
				{ group: 'Way Of Pain', options: ['Share My Pain'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 9, auto: ['Swift Feet'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 10,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Chain Reaction'] },
				{ group: 'Way Of Pain', options: ['Pain Sharpens the Mind'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Iron Defense'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Way Of Flame', options: ['Burning Soul'] },
				{ group: 'Way Of Pain', options: ['Echoed Agony'] },
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 17, auto: [], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 18,
			auto: ['Martial Arts Ability'],
			pools: [MARTIAL_ARTS_POOL()],
			subclass: [],
			asi: null,
		},
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Windborne'], pools: [], subclass: [], asi: 'capstone' },
	],
};

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

describe('Zephyr character creation (level 1)', () => {
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

describe('Zephyr subclass configuration', () => {
	it('selects a subclass at the reported level', () => {
		expect(getClassMeta(CLASS_ID).subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
	});

	it('exposes exactly the reported number of subclasses', () => {
		expect(getClassMeta(CLASS_ID).subclassGroups.length).toBe(REPORT.subclasses.length);
	});
});

describe('Zephyr integrity invariants', () => {
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

describe('Zephyr auto-grant union across all levels', () => {
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

describe('Zephyr ASI schedule', () => {
	it('matches the reported ability-score-increase schedule level by level', () => {
		const actual = summaries.map((s) => ({ level: s.level, asi: s.asi }));
		const expected = REPORT.levels.map((l) => ({ level: l.level, asi: l.asi }));
		expect(actual).toEqual(expected);
	});

	it('makes level 17 an ASI-only level with no feature grants or pools', () => {
		const l17 = summaries[16];
		expect(l17.level).toBe(17);
		expect(l17.asi).toBe('secondary');
		expect(l17.newAutoGrants).toEqual([]);
		expect(l17.optionFeatureNames).toEqual([]);
		expect(Object.keys(l17.offeredGroups)).toEqual([]);
	});
});

describe('Zephyr selection pools per level', () => {
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

	it('offers the full Martial Arts Ability option list when it is first unlocked (level 4)', () => {
		const summary = summaries[3];
		const pool = summary.offeredGroups[slug('Martial Arts Ability')];
		expect(pool).toBeDefined();
		expect(pool.selectionCount).toBe(1);
		expect([...pool.options].sort()).toEqual([...MARTIAL_ARTS_ABILITY_OPTIONS()].sort());
	});

	it('resolves the Martial Arts Ability pool at every level it is offered', () => {
		const expectedLevels = [4, 6, 8, 10, 12, 14, 16, 18];
		for (const level of expectedLevels) {
			const summary = summaries[level - 1];
			expect(summary.optionFeatureNames, `option feature @ L${level}`).toContain(
				'Martial Arts Ability',
			);
			expect(summary.offeredGroups[slug('Martial Arts Ability')], `pool @ L${level}`).toBeDefined();
		}
	});
});
