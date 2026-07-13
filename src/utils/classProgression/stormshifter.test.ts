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
 * Integration test for the Stormshifter class progression.
 *
 * Expectations mirror the human-facing test report for this class and are inlined
 * here so the test stays self-contained. The test drives the REAL feature resolver
 * via the shared harness and asserts the resolver grants exactly what the report
 * claims across character creation (level 1) and leveling 2 -> 20.
 *
 * Findings surfaced by this test (see the "report reconciliation" describe block):
 * 1. The report frames "Direbeast Form" and "Expert Shifter" as #708 option-driven
 *    features. In the actual data both have empty `levelUpOptions`, so the resolver
 *    treats them as plain multi-level auto-grant progression features. They surface
 *    in `newAutoGrants`, never in `optionFeatureNames`.
 * 2. The Direbeast Form / Chimeric Boon pools DO resolve — as DIRECT selection
 *    groups. The pool features carry `class: "stormshifter"`, so they are indexed
 *    under the class identifier and their singular `group` field ("direbeast-form"
 *    / "chimeric-boon") becomes the selection-group key. The class definition's
 *    plural `groupIdentifiers` ("direbeast-forms" / "chimeric-boons") are never
 *    consulted for these features, so the singular/plural mismatch is harmless here.
 */

const CLASS_ID = 'stormshifter';

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

function CHIMERIC_BOON_OPTIONS(): string[] {
	return [
		'Beast of the Sea',
		'Climber',
		'Earthwalker',
		'Fleet Footed',
		'Keen Senses',
		'Leader of the Pack',
		'Phasebeast',
		'Prehensile Tail',
		'Winged',
	];
}

// Inlined report spec (the report's claim for Stormshifter).
const REPORT: Report = {
	name: 'Stormshifter',
	id: 'stormshifter',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['DEX', 'WILL'],
	savingThrows: { adv: 'WILL', dis: 'STR' },
	startingGear: ['Cheap Hides', 'Staff', 'Strange Plant'],
	caster: true,
	manaFormula: '(max(@will, 0) * 3) + @level',
	subclasses: ['Circle Of Fang And Claw', 'Circle Of Sky And Storm'],
	subclassSelectLevel: 3,
	levels: [
		{ level: 1, auto: ['Beastshift', 'Master of Storms'], pools: [], subclass: [], asi: null },
		{
			level: 2,
			auto: ['Direbeast Form', 'Mana and Unlock Tier 1 Spells'],
			pools: [{ group: 'Direbeast Form', options: ['Fearsome Beast'] }],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Direbeast Form'],
			pools: [{ group: 'Direbeast Form', options: ['Beast of the Pack'] }],
			subclass: [
				{
					group: 'Circle Of Fang And Claw',
					options: ['Friend of Beasts', 'Swiftshift', 'Windborne Protector'],
				},
				{
					group: 'Circle Of Sky And Storm',
					options: ['Attuned to Nature', 'Creature of the Fey', 'Deepening Study'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Mana and Unlock Tier 1 Spells', 'Stormcaller'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['Direbeast Form'],
			pools: [{ group: 'Direbeast Form', options: ['Beast of Nightmares'] }],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Expert Shifter', 'Mana and Unlock Tier 1 Spells'],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: ['Stormcaller'],
			pools: [],
			subclass: [
				{ group: 'Circle Of Fang And Claw', options: ['Storm Wake', 'Unleash the Beast'] },
				{ group: 'Circle Of Sky And Storm', options: ['Raging Tempest'] },
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Mana and Unlock Tier 1 Spells', 'Stormborn (1)'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 9,
			auto: ['Expert Shifter'],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 10,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 11,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Circle Of Fang And Claw', options: ['Master of Forms', 'Venomous Gaze'] },
				{ group: 'Circle Of Sky And Storm', options: ['Primordial Force'] },
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Expert Shifter', 'Mana and Unlock Tier 1 Spells'],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
			subclass: [],
			asi: 'primary',
		},
		{ level: 13, auto: ['Stormborn (2)'], pools: [], subclass: [], asi: 'secondary' },
		{
			level: 14,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 15,
			auto: [],
			pools: [],
			subclass: [
				{ group: 'Circle Of Fang And Claw', options: ['Master of Forms (2)'] },
				{ group: 'Circle Of Sky And Storm', options: ['Master of Storm'] },
			],
			asi: null,
		},
		{
			level: 16,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 17,
			auto: [],
			pools: [{ group: 'Chimeric Boon', options: CHIMERIC_BOON_OPTIONS() }],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 18,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{ level: 19, auto: [], pools: [], subclass: [], asi: null },
		{ level: 20, auto: ['Archdruid'], pools: [], subclass: [], asi: 'capstone' },
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
	will: 'WILL',
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

describe('Stormshifter character creation (level 1)', () => {
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

	it('is a caster with the reported mana formula', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.caster).toBe(REPORT.caster);
		expect(meta.caster).toBe(true);
		expect(meta.manaFormula).toBe(REPORT.manaFormula);
	});

	it('auto-grants exactly the reported level 1 features', () => {
		const l1 = summaries[0];
		const granted = new Set([...l1.newAutoGrants, ...l1.optionFeatureNames]);
		expect([...granted].sort()).toEqual([...REPORT.levels[0].auto].sort());
	});
});

describe('Stormshifter subclass configuration', () => {
	it('selects a subclass at the reported level', () => {
		expect(getClassMeta(CLASS_ID).subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
	});

	it('exposes exactly the reported number of subclasses', () => {
		expect(getClassMeta(CLASS_ID).subclassGroups.length).toBe(REPORT.subclasses.length);
	});
});

describe('Stormshifter integrity invariants', () => {
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

describe('Stormshifter auto-grant union across all levels', () => {
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

describe('Stormshifter ASI schedule', () => {
	it('matches the reported ability-score-increase schedule level by level', () => {
		const actual = summaries.map((s) => ({ level: s.level, asi: s.asi }));
		const expected = REPORT.levels.map((l) => ({ level: l.level, asi: l.asi }));
		expect(actual).toEqual(expected);
	});
});

describe('Stormshifter selection pools per level', () => {
	for (const reportLevel of REPORT.levels) {
		const { level } = reportLevel;

		it(`offers the reported pool groups at level ${level}`, () => {
			const summary = summaries[level - 1];
			const expectedGroups = reportLevel.pools.map((p) => slug(p.group)).sort();
			const actualGroups = Object.keys(summary.offeredGroups).sort();
			expect(actualGroups).toEqual(expectedGroups);
		});
	}

	it('resolves the Direbeast Form pool as a direct selection group at first unlock (level 2)', () => {
		const summary = summaries[1];
		const pool = summary.offeredGroups[slug('Direbeast Form')];
		expect(pool).toBeDefined();
		expect(pool.selectionCount).toBe(1);
		expect(pool.options).toEqual(['Fearsome Beast']);
	});

	it('offers a distinct Direbeast Form option at each of levels 2, 3, 5', () => {
		expect(summaries[1].offeredGroups[slug('Direbeast Form')]?.options).toEqual(['Fearsome Beast']);
		expect(summaries[2].offeredGroups[slug('Direbeast Form')]?.options).toEqual([
			'Beast of the Pack',
		]);
		expect(summaries[4].offeredGroups[slug('Direbeast Form')]?.options).toEqual([
			'Beast of Nightmares',
		]);
	});

	it('offers the full Chimeric Boon option list and requires two picks at first unlock (level 6)', () => {
		const summary = summaries[5];
		const pool = summary.offeredGroups[slug('Chimeric Boon')];
		expect(pool).toBeDefined();
		expect(pool.selectionCount).toBe(2);
		expect([...pool.options].sort()).toEqual([...CHIMERIC_BOON_OPTIONS()].sort());
	});

	it('re-offers the Chimeric Boon pool (single pick) at levels 9, 12, 17', () => {
		for (const lvl of [9, 12, 17]) {
			const pool = summaries[lvl - 1].offeredGroups[slug('Chimeric Boon')];
			expect(pool, `Chimeric Boon @ L${lvl}`).toBeDefined();
			expect(pool.selectionCount, `Chimeric Boon count @ L${lvl}`).toBe(1);
		}
	});
});

describe('Stormshifter report reconciliation (findings)', () => {
	// FINDING: The task/report frame "Direbeast Form" and "Expert Shifter" as #708
	// option-driven features. In the data both have empty `levelUpOptions`, so the
	// resolver never surfaces them through an option picker.
	it('never surfaces any #708 option-feature picker (Direbeast Form / Expert Shifter are plain auto-grants)', () => {
		for (const s of summaries) {
			expect(s.optionFeatureNames, `option features @ L${s.level}`).toEqual([]);
		}
	});

	// FINDING: The Direbeast Form / Chimeric Boon pools resolve despite the class's
	// plural `groupIdentifiers` because the pool features carry `class: "stormshifter"`.
	it('resolves the form/boon pools via the class identifier, not the plural groupIdentifiers', () => {
		const meta = getClassMeta(CLASS_ID);
		// Class definition uses the PLURAL group ids...
		expect(meta.groupIdentifiers).toContain('direbeast-forms');
		expect(meta.groupIdentifiers).toContain('chimeric-boons');
		// ...but the resolver still exposes the SINGULAR-keyed selection groups.
		expect(summaries[1].offeredGroups).toHaveProperty('direbeast-form');
		expect(summaries[5].offeredGroups).toHaveProperty('chimeric-boon');
	});
});
