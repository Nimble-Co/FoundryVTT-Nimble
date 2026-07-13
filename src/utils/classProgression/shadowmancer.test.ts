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
 * Integration test for the Shadowmancer class level-up progression.
 *
 * Drives the REAL feature resolver over the on-disk compendium data and asserts
 * it grants/offers exactly what the human-facing report claims across creation
 * (L1) and leveling 2 -> 20.
 *
 * Shadowmancer specifics under test:
 *  - TWO invocation pool groups: lesser-invocations & greater-invocations.
 *  - The #708 option features "The Pact is Sealed" (lesser) and
 *    "Gift from the Master" (greater), which surface as option pickers.
 *  - The only class with an L19 grant (repeated "Master of Darkness").
 */

const CLASS_ID = 'shadowmancer';

// Report ability codes -> compendium ability identifiers.
const ABILITY_CODE: Record<string, string> = {
	STR: 'strength',
	DEX: 'dexterity',
	CON: 'constitution',
	INT: 'intelligence',
	WIS: 'wisdom',
	CHA: 'charisma',
	WILL: 'will',
};

// Report pool group display names -> compendium group identifiers.
function slugGroup(name: string): string {
	return name.toLowerCase().replace(/\s+/g, '-');
}

// Full option pools as claimed by the report.
const LESSER: string[] = [
	'Abhorrent Speech',
	'Beguiling Influence',
	'Blood Sight',
	'Devoted Acolyte',
	'Eldritch Sense',
	'Gaze of Two Minds',
	'Knowledge from Beyond',
	'My Favored Pet',
	'Voice of the Dark',
	'Whispers of the Grave',
];
const GREATER: string[] = [
	'Armor of Shadows',
	'Fiendish Boon',
	'Hungering Shadows',
	'One with Shadows',
	'Repelling Blast',
	'Shadow Magus',
	'Shadow Rush',
	'Shadow Spear',
	'Shadow Warp',
	'Swarming Shadows',
	'Vengeful Blast',
];

interface ReportPool {
	group: string;
	options: string[];
}
interface ReportLevel {
	level: number;
	auto: string[];
	pools: ReportPool[];
	subclass: unknown[];
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

// The report JSON lives in the scratchpad; inline the values it asserts so the
// test is self-contained and does not depend on a transient path at runtime.
const report: Report = {
	name: 'Shadowmancer',
	id: 'shadowmancer',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['INT', 'DEX'],
	savingThrows: { adv: 'INT', dis: 'WILL' },
	startingGear: ["Adventurer's Garb", 'Sickle', 'Shovel'],
	caster: true,
	manaFormula: '(max(@dexterity, 0))',
	subclasses: ['Pact Of The Abyssal Depths', 'Pact Of The Red Dragon', 'Reaver'],
	subclassSelectLevel: 1,
	levels: [
		{ level: 1, auto: ['Conduit of Shadow'], pools: [], subclass: [{}], asi: null },
		{
			level: 2,
			auto: ['Master of Darkness', 'Pilfered Power'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['The Pact is Sealed'],
			pools: [{ group: 'Lesser Invocations', options: LESSER }],
			subclass: [{}, {}, {}],
			asi: null,
		},
		{
			level: 4,
			auto: ['Gift from the Master'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 5, auto: ['Master of Darkness'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 6,
			auto: ['Gift from the Master', 'Shadowmastery'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: null,
		},
		{ level: 7, auto: ['Master of Darkness'], pools: [], subclass: [{}, {}, {}], asi: null },
		{
			level: 8,
			auto: ['Shadowmastery', 'The Pact is Sealed'],
			pools: [{ group: 'Lesser Invocations', options: LESSER }],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 9,
			auto: ['Gift from the Master'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: 'secondary',
		},
		{ level: 10, auto: ['Master of Darkness'], pools: [], subclass: [], asi: null },
		{
			level: 11,
			auto: ['The Pact is Sealed'],
			pools: [{ group: 'Lesser Invocations', options: LESSER }],
			subclass: [{}, {}, {}],
			asi: null,
		},
		{ level: 12, auto: ['Greedy pact'], pools: [], subclass: [], asi: 'primary' },
		{ level: 13, auto: ['Master of Darkness'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Gift from the Master', 'Shadowmastery'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: null,
		},
		{ level: 15, auto: [], pools: [], subclass: [{}, {}, {}], asi: null },
		{ level: 16, auto: ['Master of Darkness'], pools: [], subclass: [], asi: 'primary' },
		{ level: 17, auto: ['Dire Shadows'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 18,
			auto: ['Gift from the Master'],
			pools: [{ group: 'Greater Invocations', options: GREATER }],
			subclass: [],
			asi: null,
		},
		{ level: 19, auto: ['Master of Darkness'], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Eldritch Usurper'], pools: [], subclass: [], asi: 'capstone' },
	],
};

const OPTION_FEATURES = new Set(['The Pact is Sealed', 'Gift from the Master']);

describe('Shadowmancer class progression', () => {
	let index: ClassFeatureIndex;
	let summaries: LevelSummary[];

	beforeAll(async () => {
		index = await buildRealIndex();
		summaries = await simulateProgression(index, CLASS_ID);
	});

	afterAll(() => {
		restoreMocks();
	});

	const summaryFor = (level: number): LevelSummary => {
		const s = summaries.find((x) => x.level === level);
		if (!s) throw new Error(`No summary for level ${level}`);
		return s;
	};
	const reportFor = (level: number): ReportLevel => {
		const r = report.levels.find((x) => x.level === level);
		if (!r) throw new Error(`No report entry for level ${level}`);
		return r;
	};

	describe('creation (L1) metadata', () => {
		it('matches class metadata from the report', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.name).toBe(report.name);
			expect(meta.identifier).toBe(report.id);
			expect(meta.hitDieSize).toBe(report.hitDie);
			expect(meta.startingHp).toBe(report.startingHp);
			expect(meta.keyAbilityScores).toEqual(report.keyAbilities.map((c) => ABILITY_CODE[c]));
			expect(meta.savingThrows.advantage).toBe(ABILITY_CODE[report.savingThrows.adv]);
			expect(meta.savingThrows.disadvantage).toBe(ABILITY_CODE[report.savingThrows.dis]);
			expect(meta.startingGear).toEqual(report.startingGear);
			expect(meta.caster).toBe(report.caster);
			expect(meta.manaFormula).toBe(report.manaFormula);
		});

		it('grants Conduit of Shadow and offers no pools at L1', () => {
			const s = summaryFor(1);
			expect(s.newAutoGrants).toContain('Conduit of Shadow');
			expect(Object.keys(s.offeredGroups)).toHaveLength(0);
			expect(s.optionFeatureNames).toHaveLength(0);
		});
	});

	describe('subclass selection (out of scope for options)', () => {
		it('selects subclass at L1 with 3 subclass groups', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.subclassSelectLevel).toBe(report.subclassSelectLevel);
			expect(meta.subclassGroups).toHaveLength(report.subclasses.length);
			expect(summaryFor(1).isSubclassSelectLevel).toBe(true);
			for (let level = 2; level <= 20; level++) {
				expect(summaryFor(level).isSubclassSelectLevel).toBe(false);
			}
		});
	});

	describe('per-level auto-grants (union incl. L19)', () => {
		it('grants every auto feature at the correct level or earlier (repeats not re-granted)', () => {
			// Accumulate everything the system grants/offers as we climb levels, then
			// assert each report `auto` entry is present by the level it is claimed.
			const granted = new Set<string>();
			for (let level = 1; level <= 20; level++) {
				const s = summaryFor(level);
				for (const n of s.newAutoGrants) granted.add(n);
				for (const n of s.optionFeatureNames) granted.add(n);
				for (const claimed of reportFor(level).auto) {
					expect(granted.has(claimed)).toBe(true);
				}
			}
		});

		it('union of auto-grants + option features equals the report union', () => {
			const reportUnion = new Set<string>();
			for (const l of report.levels) for (const n of l.auto) reportUnion.add(n);

			const resolvedUnion = new Set<string>();
			for (const s of summaries) {
				for (const n of s.newAutoGrants) resolvedUnion.add(n);
				for (const n of s.optionFeatureNames) resolvedUnion.add(n);
			}
			expect([...resolvedUnion].sort()).toEqual([...reportUnion].sort());
		});

		it('L19 grant (Master of Darkness) lines up and is a repeat, not a fresh grant', () => {
			expect(reportFor(19).auto).toEqual(['Master of Darkness']);
			// It was first granted at L2; the resolver must NOT re-grant it at L19.
			expect(summaryFor(19).newAutoGrants).not.toContain('Master of Darkness');
			expect(summaryFor(2).newAutoGrants).toContain('Master of Darkness');
			// It is nonetheless part of the overall granted set.
			const everGranted = new Set(summaries.flatMap((s) => s.newAutoGrants));
			expect(everGranted.has('Master of Darkness')).toBe(true);
		});
	});

	describe('#708 option features', () => {
		it('surfaces The Pact is Sealed at every lesser-invocation level (3,8,11)', () => {
			for (const level of [3, 8, 11]) {
				expect(summaryFor(level).optionFeatureNames).toContain('The Pact is Sealed');
			}
		});

		it('surfaces Gift from the Master at every greater-invocation level (4,6,9,14,18)', () => {
			for (const level of [4, 6, 9, 14, 18]) {
				expect(summaryFor(level).optionFeatureNames).toContain('Gift from the Master');
			}
		});

		it('does not surface option features at unrelated levels', () => {
			for (let level = 1; level <= 20; level++) {
				const expectsOption = reportFor(level).auto.some((n) => OPTION_FEATURES.has(n));
				const hasOption = summaryFor(level).optionFeatureNames.some((n) => OPTION_FEATURES.has(n));
				expect(hasOption).toBe(expectsOption);
			}
		});
	});

	describe('invocation pools (both groups)', () => {
		it('offers each report pool with a valid count and enough options', () => {
			for (let level = 1; level <= 20; level++) {
				const r = reportFor(level);
				const s = summaryFor(level);
				for (const pool of r.pools) {
					const key = slugGroup(pool.group);
					const offered = s.offeredGroups[key];
					expect(offered, `level ${level} group ${key}`).toBeDefined();
					expect(offered.selectionCount).toBeGreaterThanOrEqual(1);
					// Fewer options than the required count is a real bug.
					expect(offered.options.length).toBeGreaterThanOrEqual(offered.selectionCount);
					// Every offered option must belong to the report's declared pool.
					for (const opt of offered.options) {
						expect(pool.options, `level ${level} option ${opt}`).toContain(opt);
					}
				}
				// No unexpected non-subclass pools beyond what the report declares.
				const expectedKeys = new Set(r.pools.map((p) => slugGroup(p.group)));
				for (const key of Object.keys(s.offeredGroups)) {
					expect(expectedKeys.has(key), `level ${level} unexpected group ${key}`).toBe(true);
				}
			}
		});

		it('resolves lesser-invocations at 3/8/11 and greater-invocations at 4/6/9/14/18', () => {
			for (const level of [3, 8, 11]) {
				expect(summaryFor(level).offeredGroups['lesser-invocations']).toBeDefined();
			}
			for (const level of [4, 6, 9, 14, 18]) {
				expect(summaryFor(level).offeredGroups['greater-invocations']).toBeDefined();
			}
		});
	});

	describe('ability score increases', () => {
		it('matches the report ASI at every level', () => {
			for (let level = 1; level <= 20; level++) {
				expect(summaryFor(level).asi, `level ${level}`).toBe(reportFor(level).asi);
			}
		});
	});

	describe('data integrity', () => {
		it('produces exactly 20 level summaries', () => {
			expect(summaries).toHaveLength(20);
			expect(summaries.map((s) => s.level)).toEqual(Array.from({ length: 20 }, (_v, i) => i + 1));
		});

		it('never auto-grants the same feature twice', () => {
			const all = summaries.flatMap((s) => s.newAutoGrants);
			expect(all.length).toBe(new Set(all).size);
		});
	});
});
