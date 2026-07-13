import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildRealIndex,
	type ClassMeta,
	getClassMeta,
	type LevelSummary,
	resolveLevel,
	restoreMocks,
	simulateProgression,
} from '../../../tests/fixtures/classProgression.ts';
import type { ClassFeatureIndex } from '../getClassFeatures.ts';

/**
 * Integration test for the Shepherd class.
 *
 * Drives the REAL feature resolver against the on-disk compendium and checks the
 * grants/pools/ASI/caster data against the human-facing expectation report.
 *
 * Notable data shape: every Shepherd feature carries `class: "shepherd"`, so the
 * resolver indexes them by class identifier. That means the known
 * `groupIdentifiers: ["...","sacred-graces"]` (plural) vs feature `group:
 * "sacred-grace"` (singular) mismatch never blocks resolution — the sacred-grace
 * pool is reached through the class key and the #708 "Sacred Graces" option
 * feature, not through the plural group identifier. See the dedicated test below.
 */

const CLASS_ID = 'shepherd';

// Feature `group` slug for the sacred-grace pool (singular — matches feature data).
const SACRED_GRACE_GROUP = 'sacred-grace';

// The eight sacred-grace options, per the expectation report.
const SACRED_GRACE_OPTIONS = [
	'Assist Me, My Friend!',
	'Empowered Companion',
	'Guiding Spirit',
	'Hasty Companion',
	'Illuminate Soul',
	'Light Bearer',
	'Not Beyond MY Reach',
	'Vengeful Spirit',
];

const ABBREV: Record<string, string> = {
	strength: 'STR',
	dexterity: 'DEX',
	constitution: 'CON',
	intelligence: 'INT',
	wisdom: 'WIS',
	will: 'WILL',
	charisma: 'CHA',
};

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

// Embedded copy of scratchpad/expectations/shepherd.json (source of truth).
const REPORT = {
	name: 'Shepherd',
	id: 'shepherd',
	hitDie: 10,
	startingHp: 17,
	keyAbilities: ['STR', 'WILL'],
	savingThrows: { adv: 'WILL', dis: 'DEX' },
	startingGear: ['Rusty Mail', 'Mace', 'Wooden Buckler', 'Bell'],
	caster: true,
	manaFormula: '(max(@will, 0) * 3) + @level',
	subclasses: ['Luminary Of Malice', 'Luminary Of Mercy'],
	subclassSelectLevel: 3,
	levels: [
		{
			level: 1,
			auto: ['Keeper of Life & Death', 'Searing Light'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 2,
			auto: ['Lifebinding Spirit', 'Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{ level: 3, auto: ['Master of Twilight'], pools: [], subclass: [{}, {}], asi: null },
		{ level: 4, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{
			level: 5,
			auto: ['Sacred Graces'],
			pools: [{ group: 'Sacred Grace', options: SACRED_GRACE_OPTIONS }],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Mana and Unlock Tier 1 Spells', 'Master of Twilight'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{ level: 7, auto: [], pools: [], subclass: [{}, {}], asi: null },
		{ level: 8, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{
			level: 9,
			auto: ['Sacred Graces'],
			pools: [{ group: 'Sacred Grace', options: SACRED_GRACE_OPTIONS }],
			subclass: [],
			asi: 'secondary',
		},
		{ level: 10, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: null },
		{ level: 11, auto: ['Master of Twilight'], pools: [], subclass: [{}, {}], asi: null },
		{ level: 12, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{
			level: 13,
			auto: ['Sacred Graces'],
			pools: [{ group: 'Sacred Grace', options: SACRED_GRACE_OPTIONS }],
			subclass: [],
			asi: 'secondary',
		},
		{ level: 14, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: null },
		{ level: 15, auto: [], pools: [], subclass: [{}, {}], asi: null },
		{ level: 16, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: 'primary' },
		{ level: 17, auto: ['Revitalizing Blessing'], pools: [], subclass: [], asi: 'secondary' },
		{ level: 18, auto: ['Mana and Unlock Tier 1 Spells'], pools: [], subclass: [], asi: null },
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Twilight Sage'], pools: [], subclass: [], asi: 'capstone' },
	] as ReportLevel[],
};

function slug(group: string): string {
	return group.toLowerCase().replace(/\s+/g, '-');
}

let index: ClassFeatureIndex;
let meta: ClassMeta;
let summaries: LevelSummary[];

beforeAll(async () => {
	index = await buildRealIndex();
	meta = getClassMeta(CLASS_ID);
	summaries = await simulateProgression(index, CLASS_ID);
});

afterAll(() => {
	restoreMocks();
});

describe('Shepherd — creation (level 1) & class metadata', () => {
	it('matches identity, hit die, starting HP, key abilities, saves, and gear', () => {
		expect(meta.name).toBe(REPORT.name);
		expect(meta.identifier).toBe(REPORT.id);
		expect(meta.hitDieSize).toBe(REPORT.hitDie);
		expect(meta.startingHp).toBe(REPORT.startingHp);
		expect(meta.keyAbilityScores.map((a) => ABBREV[a])).toEqual(REPORT.keyAbilities);
		expect(ABBREV[meta.savingThrows.advantage]).toBe(REPORT.savingThrows.adv);
		expect(ABBREV[meta.savingThrows.disadvantage]).toBe(REPORT.savingThrows.dis);
		expect(meta.startingGear).toEqual(REPORT.startingGear);
	});

	it('is a caster with the reported mana formula', () => {
		expect(meta.caster).toBe(true);
		expect(meta.manaFormula).toBe(REPORT.manaFormula);
	});

	it('auto-grants exactly the reported level-1 features and offers no pools', () => {
		const l1 = summaries[0];
		expect(l1.level).toBe(1);
		expect([...l1.newAutoGrants].sort()).toEqual([...REPORT.levels[0].auto].sort());
		expect(l1.optionFeatureNames).toEqual([]);
		expect(Object.keys(l1.offeredGroups)).toEqual([]);
		expect(l1.asi).toBeNull();
	});
});

describe('Shepherd — subclass metadata (scope-limited)', () => {
	it('selects a subclass at the reported level with the reported number of subclasses', () => {
		expect(meta.subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
		expect(meta.subclassGroups.length).toBe(REPORT.subclasses.length);
	});

	it('flags exactly one subclass-select level in the progression', () => {
		const flagged = summaries.filter((s) => s.isSubclassSelectLevel).map((s) => s.level);
		expect(flagged).toEqual([REPORT.subclassSelectLevel]);
	});
});

describe('Shepherd — per-level auto grants, option features, pools, and ASI (2→20)', () => {
	for (const rl of REPORT.levels) {
		it(`level ${rl.level}`, () => {
			const s = summaries[rl.level - 1];
			expect(s.level).toBe(rl.level);

			// ASI matches the report exactly.
			expect(s.asi).toBe(rl.asi);

			// Everything newly granted (auto) or surfaced as a #708 option feature at
			// this level must be listed in the report's `auto` for this level.
			for (const name of [...s.newAutoGrants, ...s.optionFeatureNames]) {
				expect(rl.auto).toContain(name);
			}

			// Offered non-subclass pools must correspond exactly to the report's pools
			// (subclass groups are out of scope and never surface as pools).
			const expectedKeys = rl.pools.map((p) => slug(p.group)).sort();
			expect(Object.keys(s.offeredGroups).sort()).toEqual(expectedKeys);

			for (const pool of rl.pools) {
				const key = slug(pool.group);
				const offered = s.offeredGroups[key];
				expect(offered, `pool ${key} missing at level ${rl.level}`).toBeDefined();
				expect(offered.selectionCount).toBeGreaterThanOrEqual(1);
				// Enough options to satisfy the required selection count (too few = real bug).
				expect(offered.options.length).toBeGreaterThanOrEqual(offered.selectionCount);
				// Every offered option is a known option from the report.
				for (const opt of offered.options) expect(pool.options).toContain(opt);
			}
		});
	}
});

describe('Shepherd — sacred-grace pool resolution (singular/plural groupIdentifier check)', () => {
	it('documents that groupIdentifiers uses the plural "sacred-graces" while features use singular "sacred-grace"', () => {
		expect(meta.groupIdentifiers).toContain('sacred-graces');
	});

	it('resolves the pool fully at level 5 despite the mismatch (features carry class:shepherd)', () => {
		const l5 = summaries[4];
		const offered = l5.offeredGroups[SACRED_GRACE_GROUP];
		expect(offered, 'sacred-grace pool did not resolve at level 5').toBeDefined();
		// Nothing owned yet at first offering: all eight graces are available.
		expect([...offered.options].sort()).toEqual([...SACRED_GRACE_OPTIONS].sort());
		expect(offered.selectionCount).toBeGreaterThanOrEqual(1);
		// The plural group identifier is NOT the key the pool resolves under.
		expect(l5.offeredGroups['sacred-graces']).toBeUndefined();
	});

	it('re-offers the pool at levels 9 and 13 (remaining, unowned graces)', () => {
		for (const level of [9, 13]) {
			const offered = summaries[level - 1].offeredGroups[SACRED_GRACE_GROUP];
			expect(offered, `sacred-grace pool did not resolve at level ${level}`).toBeDefined();
			expect(offered.options.length).toBeGreaterThan(0);
			for (const opt of offered.options) expect(SACRED_GRACE_OPTIONS).toContain(opt);
		}
	});

	it('presents the pool through the #708 "Sacred Graces" option feature, not a direct selection group', async () => {
		const raw = await resolveLevel(index, CLASS_ID, 5);
		expect(raw.optionFeatures.map((f) => f.name)).toContain('Sacred Graces');
		// The pool is covered by the option picker, so it must NOT also appear as a
		// direct selection group (that would duplicate the list).
		expect(raw.selectionGroups.has(SACRED_GRACE_GROUP)).toBe(false);
		expect(raw.selectionGroups.has('sacred-graces')).toBe(false);
	});
});

describe('Shepherd — data integrity across the full progression', () => {
	it('produces exactly 20 level summaries', () => {
		expect(summaries).toHaveLength(20);
		expect(summaries.map((s) => s.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
	});

	it('never auto-grants the same feature twice', () => {
		const granted: string[] = [];
		for (const s of summaries) granted.push(...s.newAutoGrants);
		expect(new Set(granted).size).toBe(granted.length);
	});

	it('every offered pool always has at least as many options as its selection count', () => {
		for (const s of summaries) {
			for (const [group, pool] of Object.entries(s.offeredGroups)) {
				expect(
					pool.options.length,
					`group ${group} at level ${s.level} has too few options`,
				).toBeGreaterThanOrEqual(pool.selectionCount);
			}
		}
	});

	it('the union of real grants (auto ∪ option-features) equals the union of reported auto features', () => {
		const real = new Set<string>();
		for (const s of summaries) {
			for (const n of s.newAutoGrants) real.add(n);
			for (const n of s.optionFeatureNames) real.add(n);
		}
		const reported = new Set<string>();
		for (const rl of REPORT.levels) for (const n of rl.auto) reported.add(n);
		expect([...real].sort()).toEqual([...reported].sort());
	});
});
