import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildRealIndex,
	type ClassMeta,
	getClassMeta,
	type LevelSummary,
	restoreMocks,
	simulateProgression,
} from '../../../tests/fixtures/classProgression.ts';
import type { ClassFeatureIndex } from '../getClassFeatures.ts';

/**
 * Integration test for the Hunter class level-up feature resolver.
 *
 * Drives the REAL resolver (via the shared harness reading real `packs/` JSON)
 * and verifies it grants exactly what the human-facing report claims across
 * creation (L1) and leveling 2 -> 20.
 *
 * Hunter is the richest #708 case: `thrill-of-the-hunt` is presented through an
 * option feature ("Thrill of the Hunt", group `hunter-progression`) whose pick
 * count changes by level (2 at L2, 1 at L4/6/8/12/14).
 */

const CLASS_ID = 'hunter';

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
	levels: ReportLevel[];
	subclasses: string[];
	subclassSelectLevel: number;
}

const REPORT_PATH =
	'/private/tmp/claude-503/-Users-trevorcarlston-Developer-hobby-FoundryVTT-NimbleDev-FoundryVTT-Nimble-tc-feat-708-select-one-option-or-another-on-level-up/2e5bf7ba-4eda-495e-ab48-13cfbe6d1fb9/scratchpad/expectations/hunter.json';

const report: Report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));

// The report abbreviates ability names; the class JSON (and therefore meta) uses
// full names. This is a report-representation difference, not a system bug, so we
// normalize meta's full names to the report's abbreviations before comparing.
const ABILITY_ABBR: Record<string, string> = {
	strength: 'STR',
	dexterity: 'DEX',
	constitution: 'CON',
	intelligence: 'INT',
	wisdom: 'WIS',
	will: 'WILL',
	charisma: 'CHA',
};
const abbr = (name: string): string => ABILITY_ABBR[name] ?? name;

// The report labels pools by display name ("Thrill Of The Hunt"); the resolver
// keys `offeredGroups` by the group identifier ("thrill-of-the-hunt").
const toGroupId = (displayName: string): string => displayName.toLowerCase().replaceAll(' ', '-');

const SUBCLASS_GROUP_IDS = new Set(report.subclasses.map(toGroupId));

let index: ClassFeatureIndex;
let meta: ClassMeta;
let summaries: LevelSummary[];

const summaryFor = (level: number): LevelSummary => {
	const s = summaries[level - 1];
	if (!s || s.level !== level) throw new Error(`No summary for level ${level}`);
	return s;
};

beforeAll(async () => {
	index = await buildRealIndex();
	meta = getClassMeta(CLASS_ID);
	summaries = await simulateProgression(index, CLASS_ID);
});

afterAll(() => {
	restoreMocks();
});

describe('Hunter class metadata (creation / L1)', () => {
	it('matches identity, hit die, and starting HP', () => {
		expect(meta.name).toBe(report.name);
		expect(meta.identifier).toBe(report.id);
		expect(meta.hitDieSize).toBe(report.hitDie);
		expect(meta.startingHp).toBe(report.startingHp);
	});

	it('matches key ability scores', () => {
		expect(meta.keyAbilityScores.map(abbr)).toEqual(report.keyAbilities);
	});

	it('matches saving throw advantage / disadvantage', () => {
		expect(abbr(meta.savingThrows.advantage)).toBe(report.savingThrows.adv);
		expect(abbr(meta.savingThrows.disadvantage)).toBe(report.savingThrows.dis);
	});

	it('matches starting gear', () => {
		expect(meta.startingGear).toEqual(report.startingGear);
	});

	it('matches caster / mana profile (non-caster)', () => {
		expect(meta.caster).toBe(report.caster);
		expect(meta.manaFormula).toBe(report.manaFormula);
	});
});

describe('Subclass handling (out of scope for resolver)', () => {
	it('reports the expected subclass select level', () => {
		expect(meta.subclassSelectLevel).toBe(report.subclassSelectLevel);
		expect(summaryFor(1).isSubclassSelectLevel).toBe(true);
	});

	it('exposes one subclass group per reported subclass', () => {
		expect(meta.subclassGroups.length).toBe(report.subclasses.length);
	});

	it('never surfaces subclass groups as offered pools at any level', () => {
		for (const s of summaries) {
			for (const key of Object.keys(s.offeredGroups)) {
				expect(SUBCLASS_GROUP_IDS.has(key)).toBe(false);
			}
		}
	});
});

describe('Level 1 (creation) grants', () => {
	it("auto-grants exactly Forager and Hunter's Mark", () => {
		const l1 = summaryFor(1);
		expect([...l1.newAutoGrants].sort()).toEqual([...report.levels[0].auto].sort());
	});

	it('offers no in-scope selection pools and no option features at L1', () => {
		const l1 = summaryFor(1);
		expect(l1.optionFeatureNames).toEqual([]);
		expect(Object.keys(l1.offeredGroups)).toEqual([]);
	});
});

describe('Auto-grant integrity across all levels', () => {
	it('the union of granted features matches the report union', () => {
		const expectedUnion = new Set<string>();
		for (const lvl of report.levels) for (const name of lvl.auto) expectedUnion.add(name);

		const actualUnion = new Set<string>();
		for (const s of summaries) {
			for (const name of s.newAutoGrants) actualUnion.add(name);
			for (const name of s.optionFeatureNames) actualUnion.add(name);
		}

		expect([...actualUnion].sort()).toEqual([...expectedUnion].sort());
	});

	it('never auto-grants the same feature twice', () => {
		const seen = new Set<string>();
		for (const s of summaries) {
			for (const name of s.newAutoGrants) {
				expect(seen.has(name)).toBe(false);
				seen.add(name);
			}
		}
	});

	it('produces exactly 20 level summaries', () => {
		expect(summaries).toHaveLength(20);
		expect(summaries.map((s) => s.level)).toEqual(Array.from({ length: 20 }, (_v, i) => i + 1));
	});
});

describe('Per-level offered pools and ASI (levels 2-20)', () => {
	for (const reportLevel of report.levels) {
		if (reportLevel.level < 2) continue;
		const { level } = reportLevel;

		it(`level ${level}: ASI matches the report`, () => {
			expect(summaryFor(level).asi).toBe(reportLevel.asi);
		});

		it(`level ${level}: offered pool groups match the report`, () => {
			const expectedGroups = reportLevel.pools.map((p) => toGroupId(p.group)).sort();
			const actualGroups = Object.keys(summaryFor(level).offeredGroups).sort();
			expect(actualGroups).toEqual(expectedGroups);
		});

		it(`level ${level}: each offered pool has a valid count and enough options`, () => {
			const s = summaryFor(level);
			for (const pool of reportLevel.pools) {
				const offered = s.offeredGroups[toGroupId(pool.group)];
				expect(offered).toBeDefined();
				expect(offered.selectionCount).toBeGreaterThanOrEqual(1);
				expect(offered.options.length).toBeGreaterThanOrEqual(offered.selectionCount);
			}
		});
	}
});

describe('Thrill of the Hunt (#708 option feature) selection counts', () => {
	// Levels at which the option feature presents a Thrill of the Hunt pick.
	const THRILL_LEVELS = [2, 4, 6, 8, 12, 14];
	const THRILL_GROUP = 'thrill-of-the-hunt';
	// Per the option feature's levelUpOptions: 2 picks at L2, 1 pick thereafter.
	const EXPECTED_COUNT: Record<number, number> = { 2: 2, 4: 1, 6: 1, 8: 1, 12: 1, 14: 1 };

	it('surfaces the "Thrill of the Hunt" option feature only at the expected levels', () => {
		for (const s of summaries) {
			const hasThrill = s.optionFeatureNames.includes('Thrill of the Hunt');
			expect(hasThrill).toBe(THRILL_LEVELS.includes(s.level));
		}
	});

	for (const level of THRILL_LEVELS) {
		it(`level ${level}: selection count is ${EXPECTED_COUNT[level]}`, () => {
			const offered = summaryFor(level).offeredGroups[THRILL_GROUP];
			expect(offered).toBeDefined();
			expect(offered.selectionCount).toBe(EXPECTED_COUNT[level]);
			expect(offered.options.length).toBeGreaterThanOrEqual(offered.selectionCount);
		});
	}

	it('offers the full 14-ability pool at first appearance (L2)', () => {
		const l2Report = report.levels.find((l) => l.level === 2)!;
		const expectedOptions = l2Report.pools.find(
			(p) => toGroupId(p.group) === THRILL_GROUP,
		)!.options;
		const offered = summaryFor(2).offeredGroups[THRILL_GROUP];
		expect([...offered.options].sort()).toEqual([...expectedOptions].sort());
	});

	it('shrinks the pool as picks are made across levels', () => {
		let previous = Number.POSITIVE_INFINITY;
		for (const level of THRILL_LEVELS) {
			const offered = summaryFor(level).offeredGroups[THRILL_GROUP];
			expect(offered.options.length).toBeLessThan(previous);
			previous = offered.options.length;
		}
	});
});
