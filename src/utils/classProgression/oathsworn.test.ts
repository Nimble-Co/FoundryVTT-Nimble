import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
 * Integration test for the Oathsworn class level-up resolver.
 *
 * Drives the REAL feature resolver against on-disk compendium data and checks it
 * grants exactly what the human-facing report claims for creation (L1) and
 * leveling 2 -> 20. Oathsworn is a hybrid caster with the #708 `sacred-decree`
 * option pool (offered at levels 3, 6, 9, 12, 14, 16) and repeated auto-grants
 * ("Mana and Radiant Spellcasting", "Radiant Judgement").
 */

const ID = 'oathsworn';

interface ReportPool {
	group: string;
	options: string[];
}
interface ReportLevel {
	level: number;
	auto: string[];
	pools: ReportPool[];
	subclass: { group: string; options: string[] }[];
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

const REPORT: Report = JSON.parse(
	readFileSync(
		join(
			'/private/tmp/claude-503',
			'-Users-trevorcarlston-Developer-hobby-FoundryVTT-NimbleDev-FoundryVTT-Nimble-tc-feat-708-select-one-option-or-another-on-level-up',
			'2e5bf7ba-4eda-495e-ab48-13cfbe6d1fb9',
			'scratchpad/expectations/oathsworn.json',
		),
		'utf-8',
	),
);

// The report abbreviates ability names; the class data uses full names.
const ABILITY_MAP: Record<string, string> = {
	STR: 'strength',
	DEX: 'dexterity',
	CON: 'constitution',
	INT: 'intelligence',
	WIS: 'wisdom',
	WILL: 'will',
};

// Report pool group names are display-cased ("Sacred Decree"); the resolver keys
// offeredGroups by group identifier ("sacred-decree").
const normGroup = (g: string): string => g.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// The #708 option feature that presents the sacred-decree picker; surfaces in
// optionFeatureNames rather than newAutoGrants.
const OPTION_FEATURE_NAMES = new Set(['Sacred Decree']);

let index: ClassFeatureIndex;
let summaries: LevelSummary[];

beforeAll(async () => {
	index = await buildRealIndex();
	summaries = await simulateProgression(index, ID);
});

afterAll(() => {
	restoreMocks();
});

const summaryFor = (level: number): LevelSummary => {
	const s = summaries.find((x) => x.level === level);
	if (!s) throw new Error(`No summary for level ${level}`);
	return s;
};

describe('Oathsworn - class metadata & creation (L1)', () => {
	it('matches core identity from the report', () => {
		const meta = getClassMeta(ID);
		expect(meta.name).toBe(REPORT.name);
		expect(meta.identifier).toBe(REPORT.id);
		expect(meta.hitDieSize).toBe(REPORT.hitDie);
		expect(meta.startingHp).toBe(REPORT.startingHp);
	});

	it('matches key abilities and saving throws (report abbreviations mapped)', () => {
		const meta = getClassMeta(ID);
		expect(meta.keyAbilityScores).toEqual(REPORT.keyAbilities.map((a) => ABILITY_MAP[a]));
		expect(meta.savingThrows.advantage).toBe(ABILITY_MAP[REPORT.savingThrows.adv]);
		expect(meta.savingThrows.disadvantage).toBe(ABILITY_MAP[REPORT.savingThrows.dis]);
	});

	it('matches starting gear', () => {
		const meta = getClassMeta(ID);
		expect(meta.startingGear).toEqual(REPORT.startingGear);
	});

	it('is a caster with the expected mana formula', () => {
		const meta = getClassMeta(ID);
		expect(meta.caster).toBe(true);
		expect(REPORT.caster).toBe(true);
		expect(meta.manaFormula).toBe(REPORT.manaFormula);
	});
});

describe('Oathsworn - subclass wiring (out of scope beyond select level)', () => {
	it('selects a subclass at the reported level with the right number of options', () => {
		const meta = getClassMeta(ID);
		expect(meta.subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
		expect(meta.subclassGroups.length).toBe(REPORT.subclasses.length);
	});

	it('flags exactly one subclass-select level in the simulation', () => {
		const flagged = summaries.filter((s) => s.isSubclassSelectLevel).map((s) => s.level);
		expect(flagged).toEqual([REPORT.subclassSelectLevel]);
	});
});

describe('Oathsworn - auto-grants across levels', () => {
	it('union of newAutoGrants + optionFeatures matches the report union', () => {
		const expected = new Set<string>();
		for (const lvl of REPORT.levels) for (const a of lvl.auto) expected.add(a);

		const actual = new Set<string>();
		for (const s of summaries) {
			for (const n of s.newAutoGrants) actual.add(n);
			for (const n of s.optionFeatureNames) actual.add(n);
		}

		expect([...actual].sort()).toEqual([...expected].sort());
	});

	it('never auto-grants the same feature twice (repeats collapse to first grant)', () => {
		const seen = new Set<string>();
		const doubles: string[] = [];
		for (const s of summaries) {
			for (const n of s.newAutoGrants) {
				if (seen.has(n)) doubles.push(`${n}@L${s.level}`);
				seen.add(n);
			}
		}
		expect(doubles).toEqual([]);
	});

	it('surfaces each reported non-option auto-grant at its level (new or already owned)', () => {
		const grantedByLevel = new Map<string, number>();
		for (const s of summaries) {
			for (const n of s.newAutoGrants) {
				if (!grantedByLevel.has(n)) grantedByLevel.set(n, s.level);
			}
		}

		for (const lvl of REPORT.levels) {
			const s = summaryFor(lvl.level);
			for (const name of lvl.auto) {
				if (OPTION_FEATURE_NAMES.has(name)) {
					// #708 option feature: presented via picker every listed level.
					expect(s.optionFeatureNames).toContain(name);
					continue;
				}
				const firstGrant = grantedByLevel.get(name);
				expect(firstGrant, `${name} should be auto-granted by L${lvl.level}`).toBeDefined();
				// Either newly granted here, or granted earlier and now owned (a repeat).
				expect(firstGrant! <= lvl.level).toBe(true);
			}
		}
	});
});

describe('Oathsworn - sacred-decree (#708) option pool', () => {
	const EXPECTED_POOL_LEVELS = [3, 6, 9, 12, 14, 16];
	const REPORT_OPTIONS = new Set(
		REPORT.levels
			.flatMap((l) => l.pools)
			.filter((p) => normGroup(p.group) === 'sacred-decree')
			.flatMap((p) => p.options),
	);

	it('offers the sacred-decree picker exactly at the reported levels', () => {
		const offeredAt = summaries
			.filter((s) => 'sacred-decree' in s.offeredGroups)
			.map((s) => s.level);
		expect(offeredAt).toEqual(EXPECTED_POOL_LEVELS);
	});

	it('presents the Sacred Decree option feature at exactly those levels', () => {
		const optAt = summaries
			.filter((s) => s.optionFeatureNames.includes('Sacred Decree'))
			.map((s) => s.level);
		expect(optAt).toEqual(EXPECTED_POOL_LEVELS);
	});

	it('offers count 1 with enough (subset of reported) options at each pool level', () => {
		for (const level of EXPECTED_POOL_LEVELS) {
			const pool = summaryFor(level).offeredGroups['sacred-decree'];
			expect(pool, `sacred-decree pool missing at L${level}`).toBeDefined();
			expect(pool.selectionCount).toBe(1);
			expect(pool.options.length).toBeGreaterThanOrEqual(pool.selectionCount);
			// Owned picks are removed each level, so offered is a subset of the report set.
			for (const opt of pool.options) {
				expect(REPORT_OPTIONS.has(opt), `unexpected sacred-decree option "${opt}"`).toBe(true);
			}
		}
	});

	it('exposes the full reported sacred-decree option set at first offering (L3)', () => {
		const pool = summaryFor(3).offeredGroups['sacred-decree'];
		expect([...pool.options].sort()).toEqual([...REPORT_OPTIONS].sort());
	});
});

describe('Oathsworn - pools match the report per level', () => {
	it('offers exactly the reported pool groups at each level', () => {
		for (const lvl of REPORT.levels) {
			const s = summaryFor(lvl.level);
			const expectedGroups = lvl.pools.map((p) => normGroup(p.group)).sort();
			const actualGroups = Object.keys(s.offeredGroups).sort();
			expect(actualGroups, `pool groups mismatch at L${lvl.level}`).toEqual(expectedGroups);
		}
	});

	it('every offered pool has at least as many options as its selection count', () => {
		for (const s of summaries) {
			for (const [group, pool] of Object.entries(s.offeredGroups)) {
				expect(pool.selectionCount, `${group}@L${s.level} count`).toBeGreaterThanOrEqual(1);
				expect(
					pool.options.length,
					`${group}@L${s.level} has too few options (${pool.options.length} < ${pool.selectionCount})`,
				).toBeGreaterThanOrEqual(pool.selectionCount);
			}
		}
	});
});

describe('Oathsworn - ASI per level', () => {
	it('matches the reported ability-score-increase schedule', () => {
		for (const lvl of REPORT.levels) {
			expect(summaryFor(lvl.level).asi, `ASI mismatch at L${lvl.level}`).toBe(lvl.asi);
		}
	});
});

describe('Oathsworn - data integrity', () => {
	it('produces exactly 20 level summaries (L1..L20)', () => {
		expect(summaries.length).toBe(20);
		expect(summaries.map((s) => s.level)).toEqual(Array.from({ length: 20 }, (_v, i) => i + 1));
	});
});
