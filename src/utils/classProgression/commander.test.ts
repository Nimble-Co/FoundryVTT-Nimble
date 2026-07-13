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
 * Integration test for the Commander class level-up progression.
 *
 * Drives the REAL feature resolver via the shared harness and verifies it grants
 * exactly what the human-facing progression report claims, across character
 * creation (level 1) and level-up 2 -> 20.
 *
 * Commander is deliberately complex: selectable pools for commanders-orders,
 * combat-tactics, and weapon-mastery, surfaced through the #708 option features
 * "Fit for Any Battlefield" and "Weapon Mastery". Notably, "Fit for Any Battlefield"
 * offers a genuine "one option OR another" choice at levels 6/8/10/12/16 — either
 * "+1 Max Combat Die" (a flat rule) or "Choose a Combat Ability", a single pick from
 * the COMBINED combat-tactics + commanders-orders pool.
 *
 * Expected values below are transcribed from the report spec (commander.json) so
 * the test is self-contained rather than depending on an out-of-repo scratch file.
 */

const CLASS_ID = 'commander';

/** Map full ability names (class data) to the report's abbreviations. */
const ABILITY_ABBR: Record<string, string> = {
	strength: 'STR',
	dexterity: 'DEX',
	constitution: 'CON',
	intelligence: 'INT',
	wisdom: 'WIS',
	charisma: 'CHA',
};

/** Normalize a group label/identifier so "Commanders Orders" == "commanders-orders". */
function normGroup(value: string): string {
	return value
		.toLowerCase()
		.replace(/[-\s]+/g, ' ')
		.trim();
}

// --- Report spec (expected) -------------------------------------------------

const EXPECTED = {
	name: 'Commander',
	hitDie: 10,
	startingHp: 17,
	keyAbilities: ['STR', 'INT'],
	savingThrows: { adv: 'STR', dis: 'DEX' },
	startingGear: ['Hand Axe', 'Javelin', 'Rusty Mail'],
	caster: false,
	manaFormula: '',
	subclassCount: 3,
	subclassSelectLevel: 1,
};

/** Deduped union of every feature the report lists under `auto` at any level. */
const EXPECTED_AUTO_UNION = [
	"Commander's Orders",
	'Field Medic',
	'Fit for Any Battlefield',
	'Combat Tactics',
	'Master Commander',
	'Weapon Mastery',
	'Unparalleled Tactics',
	'Captain of Legions',
];

/** #708 option features expected to surface a picker, keyed by level. */
const EXPECTED_OPTION_FEATURES: Record<number, string[]> = {
	4: ['Fit for Any Battlefield'],
	6: ['Fit for Any Battlefield', 'Weapon Mastery'],
	8: ['Fit for Any Battlefield'],
	10: ['Fit for Any Battlefield', 'Weapon Mastery'],
	12: ['Fit for Any Battlefield'],
	14: ['Weapon Mastery'],
	16: ['Fit for Any Battlefield'],
};

/**
 * Pool groups offered at each level. At L2 the direct "Commander's Orders" selection
 * (pick 2) is offered; at L4 the "Choose a Combat Tactic" option offers combat-tactics
 * alone; at L6/8/10/12/16 the #708 "Choose a Combat Ability" option offers ONE combined
 * pool spanning combat-tactics + commanders-orders (pick one from the union, or take the
 * "+1 Max Combat Die" alternative instead). Weapon Mastery is offered at 6/10/14.
 */
const COMBAT_ABILITY_POOL = 'combat-tactics+commanders-orders';
const EXPECTED_POOL_GROUPS: Record<number, string[]> = {
	2: ['commanders-orders'],
	4: ['combat-tactics'],
	6: [COMBAT_ABILITY_POOL, 'weapon-mastery'],
	8: [COMBAT_ABILITY_POOL],
	10: [COMBAT_ABILITY_POOL, 'weapon-mastery'],
	12: [COMBAT_ABILITY_POOL],
	14: ['weapon-mastery'],
	16: [COMBAT_ABILITY_POOL],
};

const COMBAT_TACTICS_OPTIONS = [
	'Commanding Presence',
	'Heavy Strike',
	'Inerrant Strike.',
	'Lunging Strike',
	'Sweeping Strike',
];
const COMMANDERS_ORDERS_OPTIONS = [
	'Face Me!',
	'Hold the Line!',
	'I Can Do This ALL DAY!',
	'Move it! Move it!',
	'Reposition!',
];

/** Full declared option pool per group (report `pools[].options`). */
const EXPECTED_POOL_OPTIONS: Record<string, string[]> = {
	'combat-tactics': COMBAT_TACTICS_OPTIONS,
	'commanders-orders': COMMANDERS_ORDERS_OPTIONS,
	// The combined "Choose a Combat Ability" pool draws from the union of both.
	[COMBAT_ABILITY_POOL]: [...COMBAT_TACTICS_OPTIONS, ...COMMANDERS_ORDERS_OPTIONS],
	'weapon-mastery': ['Bludgeoning', 'Piercing', 'Slashing'],
};

/** Ability-score-increase schedule (report `levels[].asi`). */
const EXPECTED_ASI: Record<number, string | null> = {
	4: 'primary',
	5: 'secondary',
	8: 'primary',
	9: 'secondary',
	12: 'primary',
	13: 'secondary',
	16: 'primary',
	17: 'secondary',
	20: 'capstone',
};

// --- Tests ------------------------------------------------------------------

let index: ClassFeatureIndex;
let summaries: LevelSummary[];

beforeAll(async () => {
	index = await buildRealIndex();
	summaries = await simulateProgression(index, CLASS_ID);
});

afterAll(() => {
	restoreMocks();
});

function summaryAt(level: number): LevelSummary {
	const s = summaries.find((entry) => entry.level === level);
	if (!s) throw new Error(`No summary for level ${level}`);
	return s;
}

describe('Commander — character creation (level 1)', () => {
	it('exposes the expected class metadata', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.name).toBe(EXPECTED.name);
		expect(meta.hitDieSize).toBe(EXPECTED.hitDie);
		expect(meta.startingHp).toBe(EXPECTED.startingHp);
		expect(meta.caster).toBe(EXPECTED.caster);
		expect(meta.manaFormula).toBe(EXPECTED.manaFormula);
	});

	it('has the expected key ability scores', () => {
		const meta = getClassMeta(CLASS_ID);
		const abbrs = meta.keyAbilityScores.map((a) => ABILITY_ABBR[a] ?? a);
		expect(abbrs).toEqual(EXPECTED.keyAbilities);
	});

	it('has the expected saving throw proficiencies', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(ABILITY_ABBR[meta.savingThrows.advantage]).toBe(EXPECTED.savingThrows.adv);
		expect(ABILITY_ABBR[meta.savingThrows.disadvantage]).toBe(EXPECTED.savingThrows.dis);
	});

	it('grants the expected starting gear', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.startingGear).toEqual(EXPECTED.startingGear);
	});

	it("auto-grants Commander's Orders at level 1 with no pools", () => {
		const l1 = summaryAt(1);
		expect(l1.newAutoGrants).toEqual(["Commander's Orders"]);
		expect(l1.optionFeatureNames).toEqual([]);
		expect(Object.keys(l1.offeredGroups)).toEqual([]);
	});
});

describe('Commander — subclass selection', () => {
	it('selects a subclass at the reported level', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.subclassSelectLevel).toBe(EXPECTED.subclassSelectLevel);
		expect(summaryAt(EXPECTED.subclassSelectLevel).isSubclassSelectLevel).toBe(true);
	});

	it('offers the reported number of subclasses', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.subclassGroups.length).toBe(EXPECTED.subclassCount);
	});
});

describe('Commander — auto-granted features', () => {
	it('grants exactly the reported set of features across all levels (auto + #708 options)', () => {
		const autoUnion = new Set<string>();
		for (const s of summaries) {
			for (const name of s.newAutoGrants) autoUnion.add(name);
			for (const name of s.optionFeatureNames) autoUnion.add(name);
		}
		expect([...autoUnion].sort()).toEqual([...EXPECTED_AUTO_UNION].sort());
	});

	it('never auto-grants the same feature at more than one level', () => {
		const seen = new Map<string, number>();
		for (const s of summaries) {
			for (const name of s.newAutoGrants) {
				expect(
					seen.has(name),
					`"${name}" auto-granted at L${seen.get(name)} and again at L${s.level}`,
				).toBe(false);
				seen.set(name, s.level);
			}
		}
	});
});

describe('Commander — #708 option features', () => {
	for (let level = 1; level <= 20; level++) {
		const expected = EXPECTED_OPTION_FEATURES[level] ?? [];
		it(`level ${level} surfaces option features [${expected.join(', ') || 'none'}]`, () => {
			expect([...summaryAt(level).optionFeatureNames].sort()).toEqual([...expected].sort());
		});
	}
});

describe('Commander — pool groups per level', () => {
	for (let level = 1; level <= 20; level++) {
		const expected = (EXPECTED_POOL_GROUPS[level] ?? []).map(normGroup).sort();
		it(`level ${level} offers pool groups [${expected.join(', ') || 'none'}]`, () => {
			const actual = Object.keys(summaryAt(level).offeredGroups).map(normGroup).sort();
			expect(actual).toEqual(expected);
		});
	}

	it('only ever surfaces options that belong to the reported pool for that group', () => {
		const declaredByNorm = new Map(
			Object.entries(EXPECTED_POOL_OPTIONS).map(([g, opts]) => [normGroup(g), opts]),
		);
		for (const s of summaries) {
			for (const [group, offered] of Object.entries(s.offeredGroups)) {
				const declared = declaredByNorm.get(normGroup(group));
				expect(declared, `unexpected pool group "${group}" at L${s.level}`).toBeDefined();
				const declaredSet = new Set(declared);
				for (const opt of offered.options) {
					expect(declaredSet.has(opt), `L${s.level} ${group}: "${opt}" not in reported pool`).toBe(
						true,
					);
				}
			}
		}
	});

	it('lets the player choose 2 Commander’s Orders at level 2', () => {
		// Rulebook: "Commander's Orders. Choose 2 Commander's Orders." At L2 this is a
		// direct selection group, so the count comes from the orders' selectionCountByLevel.
		const offered = summaryAt(2).offeredGroups['commanders-orders'];
		expect(offered).toBeDefined();
		expect(offered.selectionCount).toBe(2);
		expect(offered.options.length).toBeGreaterThanOrEqual(2);
	});
});

describe('Commander — ability score increase schedule', () => {
	for (let level = 1; level <= 20; level++) {
		const expected = EXPECTED_ASI[level] ?? null;
		it(`level ${level} ASI is ${expected ?? 'none'}`, () => {
			expect(summaryAt(level).asi).toBe(expected);
		});
	}
});

describe('Commander — data-integrity invariants', () => {
	it('produces exactly 20 level summaries (levels 1..20)', () => {
		expect(summaries).toHaveLength(20);
		expect(summaries.map((s) => s.level)).toEqual(Array.from({ length: 20 }, (_v, i) => i + 1));
	});

	it('every offered pool requires at least one selection', () => {
		for (const s of summaries) {
			for (const [group, offered] of Object.entries(s.offeredGroups)) {
				expect(
					offered.selectionCount,
					`L${s.level} ${group} selectionCount`,
				).toBeGreaterThanOrEqual(1);
			}
		}
	});

	it('never offers a pool with fewer options than its required picks', () => {
		const exhausted: string[] = [];
		for (const s of summaries) {
			for (const [group, offered] of Object.entries(s.offeredGroups)) {
				if (offered.options.length < offered.selectionCount) {
					exhausted.push(
						`L${s.level} ${group}: ${offered.options.length} < ${offered.selectionCount}`,
					);
				}
			}
		}
		expect(exhausted).toEqual([]);
	});
});

describe('Commander — "Choose a Combat Ability" is one combined pool (#708)', () => {
	// "Fit for Any Battlefield" presents, at each of levels 6/8/10/12/16, a #708
	// choice: EITHER "+1 Max Combat Die" (a flat rule, no pool) OR "Choose a Combat
	// Ability" (one pick from the combined combat-tactics + commanders-orders pool).
	for (const level of [6, 8, 10, 12, 16]) {
		it(`level ${level} offers the +1 Max Combat Die alternative and the combined ability pick`, () => {
			const options = summaryAt(level).offeredOptions;

			const maxDie = options.find((o) => o.label === '+1 Max Combat Die');
			expect(maxDie, `L${level} +1 Max Combat Die option`).toBeDefined();
			expect(maxDie?.selectionGroups).toEqual([]);
			expect(maxDie?.hasRules).toBe(true);

			const ability = options.find((o) => o.label === 'Choose a Combat Ability');
			expect(ability, `L${level} Choose a Combat Ability option`).toBeDefined();
			expect([...(ability?.selectionGroups ?? [])].sort()).toEqual([
				'combat-tactics',
				'commanders-orders',
			]);
			expect(ability?.selectionCount).toBe(1);
		});
	}

	it('draws the combined pool from the union of both groups (no per-group exhaustion)', () => {
		// Union is 10 options (5 combat-tactics + 5 commanders-orders). Across the run the
		// combined pick is taken 5 times (L6/8/10/12/16) plus one combat-tactic at L4, so the
		// union is never drained below the one pick it requires.
		for (const level of [6, 8, 10, 12, 16]) {
			const pool = summaryAt(level).offeredGroups[COMBAT_ABILITY_POOL];
			expect(pool, `L${level} combined pool`).toBeDefined();
			expect(pool.selectionCount).toBe(1);
			expect(pool.options.length).toBeGreaterThanOrEqual(1);
		}
	});
});
