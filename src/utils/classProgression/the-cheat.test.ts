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
 * Integration test for The Cheat class progression.
 *
 * Expectations mirror the human-facing test report for this class and are inlined
 * here so the test stays self-contained. The test drives the REAL feature resolver
 * via the shared harness and asserts the resolver grants exactly what the report
 * claims across character creation (level 1) and leveling 2 -> 20.
 *
 * Notable shapes for The Cheat:
 * - "Sneak Attack" is a scaling feature listed by the report at levels
 *   1, 3, 7, 9, 11, 15, 17 but is auto-granted ONCE (owned-forwarding). We assert
 *   it surfaces in `newAutoGrants` exactly once and never double-grants.
 * - "Underhanded Abilities" is a #708 option feature: it is granted once but
 *   presents the `underhanded-abilities` picker at every applicable level
 *   (4, 6, 8, 10, 12, 14, 16, 18). It surfaces via `optionFeatureNames` and its
 *   pool via `offeredGroups`, not as a plain auto-grant.
 */

const CLASS_ID = 'the-cheat';

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

/** The full Underhanded Abilities option list, offered when first unlocked (L4). */
function UNDERHANDED_ABILITIES_OPTIONS(): string[] {
	return [
		'"Creative" Accounting',
		'Exploit Weakness',
		'Feinting Attack',
		"How'd YOU get here?!",
		"I'm Outta Here!",
		'Misdirection',
		'Steal Tempo',
		'Sunder Armor (Heavy)',
		'Sunder Armor (Medium)',
		'Trickshot',
	];
}

function UNDERHANDED_POOL(): ReportPool {
	return { group: 'Underhanded Abilities', options: UNDERHANDED_ABILITIES_OPTIONS() };
}

// Inlined report spec (the report's claim for The Cheat).
const REPORT: Report = {
	name: 'The Cheat',
	id: 'the-cheat',
	hitDie: 6,
	startingHp: 10,
	keyAbilities: ['DEX', 'INT'],
	savingThrows: { adv: 'DEX', dis: 'WILL' },
	startingGear: ['Dagger', 'Sling', 'Cheap Hides', 'Chalk'],
	caster: false,
	manaFormula: '',
	subclasses: ['Tools Of The Scoundrel', 'Tools Of The Silent Blade'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Sneak Attack', 'Vicious Opportunist'], pools: [], subclass: [], asi: null },
		{ level: 2, auto: ['Cheat!'], pools: [], subclass: [], asi: null },
		{
			level: 3,
			auto: ['Sneak Attack', "Thieves' Cant"],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Low Blow', 'Sweet Talk'] },
				{
					group: 'Tools Of The Silent Blade',
					options: ['Amidst All This Commotion', 'Leave No Trace'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['Quick Read', 'Twist the Blade (1)'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ["THAT'S Not What Happened!", 'Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: ['Sneak Attack'],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Pocket Sand'] },
				{ group: 'Tools Of The Silent Blade', options: ['Cunning Strike'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 9, auto: ['Sneak Attack'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 10,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: ['Sneak Attack'],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Escape Plan'] },
				{ group: 'Tools Of The Silent Blade', options: ['Professional Skulker'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Twist the Blade (2)'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: ['Sneak Attack'],
			pools: [],
			subclass: [
				{ group: 'Tools Of The Scoundrel', options: ['Heads I Win, Tails You Lose'] },
				{ group: 'Tools Of The Silent Blade', options: ['KILL'] },
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: 'primary',
		},
		{ level: 17, auto: ['Sneak Attack'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 18,
			auto: ['Underhanded Abilities'],
			pools: [UNDERHANDED_POOL()],
			subclass: [],
			asi: null,
		},
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Supreme Execution'], pools: [], subclass: [], asi: 'capstone' },
	],
};

/** Levels the report claims re-list "Sneak Attack" (a single scaling feature). */
const SNEAK_ATTACK_REPORT_LEVELS = [1, 3, 7, 9, 11, 15, 17];

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
	will: 'WILL',
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

describe('The Cheat character creation (level 1)', () => {
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

describe('The Cheat subclass configuration', () => {
	it('selects a subclass at the reported level', () => {
		expect(getClassMeta(CLASS_ID).subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
	});

	it('exposes exactly the reported number of subclasses', () => {
		expect(getClassMeta(CLASS_ID).subclassGroups.length).toBe(REPORT.subclasses.length);
	});
});

describe('The Cheat integrity invariants', () => {
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

describe('The Cheat scaling "Sneak Attack" (owned-forwarding)', () => {
	it('auto-grants "Sneak Attack" exactly once despite being reported at many levels', () => {
		expect(SNEAK_ATTACK_REPORT_LEVELS.length).toBeGreaterThan(1);
		const grantLevels = summaries
			.filter((s) => s.newAutoGrants.includes('Sneak Attack'))
			.map((s) => s.level);
		expect(grantLevels).toEqual([1]);
	});
});

describe('The Cheat auto-grant union across all levels', () => {
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

describe('The Cheat ASI schedule', () => {
	it('matches the reported ability-score-increase schedule level by level', () => {
		const actual = summaries.map((s) => ({ level: s.level, asi: s.asi }));
		const expected = REPORT.levels.map((l) => ({ level: l.level, asi: l.asi }));
		expect(actual).toEqual(expected);
	});
});

describe('The Cheat selection pools per level', () => {
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

	it('offers the full Underhanded Abilities option list when it is first unlocked (level 4)', () => {
		const summary = summaries[3];
		const pool = summary.offeredGroups[slug('Underhanded Abilities')];
		expect(pool).toBeDefined();
		expect(pool.selectionCount).toBe(1);
		expect([...pool.options].sort()).toEqual([...UNDERHANDED_ABILITIES_OPTIONS()].sort());
	});

	it('re-offers the Underhanded Abilities picker at every applicable level (4-18 even)', () => {
		const expectedLevels = [4, 6, 8, 10, 12, 14, 16, 18];
		const actualLevels = summaries
			.filter((s) => s.optionFeatureNames.includes('Underhanded Abilities'))
			.map((s) => s.level);
		expect(actualLevels).toEqual(expectedLevels);
	});
});
