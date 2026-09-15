import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildRealIndex,
	getClassMeta,
	packFeatureHelpers,
	restoreMocks,
	simulateProgression,
} from '../../../tests/fixtures/classProgression.ts';
import type { LevelSummary } from '../../../tests/fixtures/classProgression.types.ts';
import type { ClassFeatureIndex } from '../getClassFeatures.ts';
import { MARTIAL_ARTS_ABILITY_OPTIONS, REPORT } from './zephyr.expect.ts';

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

describe('Zephyr - pack data', () => {
	const { feature, rulesOf, effectsOf, costOf } = packFeatureHelpers(CLASS_ID);

	describe('Swift Fists', () => {
		it('ships one unarmed damage rule of 1d4 plus STR', () => {
			const rules = rulesOf('Swift Fists', 'unarmedDamage');
			expect(rules).toHaveLength(1);
			const [rule] = rules;
			expect(rule.disabled).toBe(false);
			expect(rule.label).toBe('Swift Fists');
			expect(rule.predicate).toEqual({});
			expect(rule.priority).toBe(1);
			expect(rule.value).toBe('1d4 + @abilities.strength.mod');
		});

		it('names the damage in its description', () => {
			expect(feature('Swift Fists').system.description).toBe(
				'<p>Your unarmed strikes are not subject to disadvantage imposed by Rushed Attacks (see pg. 13 of the Core Rules), and their damage is 1d4+STR.</p>',
			);
		});
	});

	describe('Quickstrike', () => {
		it('ships one action delta that gives the Zephyr 1 action now', () => {
			const deltas = rulesOf('Quickstrike', 'actionDelta');
			expect(deltas).toHaveLength(1);
			const [delta] = deltas;
			expect(delta.disabled).toBe(false);
			expect(delta.predicate).toEqual({});
			expect(delta.priority).toBe(3);
			expect(delta.target).toBe('self');
			expect(delta.value).toBe('1');
			expect(delta.timing).toBe('now');
			expect(delta.borrowFromNextTurn).toBe(false);
		});

		it('ships one hidden pool that gates it until the next turn ends', () => {
			const pools = rulesOf('Quickstrike', 'chargePool');
			expect(pools).toHaveLength(1);
			const [pool] = pools;
			expect(pool.disabled).toBe(false);
			expect(pool.priority).toBe(1);
			expect(pool.identifier).toBe('quickstrike-round');
			expect(pool.label).toBe('Quickstrike (once per round)');
			expect(pool.scope).toBe('item');
			expect(pool.max).toBe('1');
			expect(pool.initial).toBe('max');
			expect(pool.dieSize).toBeNull();
			expect(pool.hidden).toBe(true);
			expect(pool.recoveries).toEqual([
				{ trigger: 'onTurnEnd', mode: 'refresh', value: '1' },
				{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
			]);
		});

		it('ships a consumer that spends one charge from that pool', () => {
			const consumers = rulesOf('Quickstrike', 'chargeConsumer');
			expect(consumers).toHaveLength(1);
			const [consumer] = consumers;
			expect(consumer.disabled).toBe(false);
			expect(consumer.priority).toBe(2);
			expect(consumer.maxCost).toBe('');
			expect(consumer.poolIdentifier).toBe('quickstrike-round');
			expect(consumer.poolScope).toBe('item');
			expect(consumer.costMode).toBe('fixed');
			expect(consumer.cost).toBe('1');
		});

		it('ships a reminder that the action buys the unarmed strike', () => {
			expect(effectsOf('Quickstrike', 'note').map((note) => [note.noteType, note.text])).toEqual([
				['reminder', 'When you Interpose, make an unarmed strike against that enemy for free.'],
			]);
		});

		it('has no activation cost of its own', () => {
			const cost = costOf('Quickstrike');
			expect(cost.type).toBe('none');
			expect(cost.isReaction).toBe(false);
		});
	});

	describe('Ethereal Projection', () => {
		it('ships one pool of one use that refreshes on a Safe Rest, off the resource bar', () => {
			const pools = rulesOf('Ethereal Projection', 'chargePool');
			expect(pools).toHaveLength(1);
			const [pool] = pools;
			expect(pool.disabled).toBe(false);
			expect(pool.priority).toBe(1);
			expect(pool.identifier).toBe('ethereal-projection-uses');
			expect(pool.label).toBe('Ethereal Projection (1/Safe Rest)');
			expect(pool.scope).toBe('item');
			expect(pool.dieSize).toBeNull();
			expect(pool.max).toBe('1');
			expect(pool.initial).toBe('max');
			expect(pool.hidden).toBe(false);
			expect(pool.showAsResource).toBe(false);
			expect(pool.recoveries).toEqual([{ trigger: 'safeRest', mode: 'refresh', value: '1' }]);
		});

		it('ships a consumer that spends one charge from that pool', () => {
			const consumers = rulesOf('Ethereal Projection', 'chargeConsumer');
			expect(consumers).toHaveLength(1);
			const [consumer] = consumers;
			expect(consumer.disabled).toBe(false);
			expect(consumer.priority).toBe(2);
			expect(consumer.maxCost).toBe('');
			expect(consumer.poolIdentifier).toBe('ethereal-projection-uses');
			expect(consumer.poolScope).toBe('item');
			expect(consumer.costMode).toBe('fixed');
			expect(consumer.cost).toBe('1');
		});
	});

	describe('Martial Arts Ability', () => {
		it('ships a description that lists every pick up to level 18', () => {
			expect(feature('Martial Arts Ability').system.description).toBe(
				'<p>Choose a Martial Arts Ability.</p><hr><p>Level 6: Choose a 2nd Martial Arts Ability.</p><p>Level 8: Choose a 3rd Martial Arts Ability.</p><p>Level 10: Choose a 4th Martial Arts Ability.</p><p>Level 12: Choose a 5th Martial Arts Ability.</p><p>Level 14: Choose a 6th Martial Arts Ability.</p><p>Level 16: Choose a 7th Martial Arts Ability.</p><p>Level 18: Choose an 8th Martial Arts Ability.</p>',
			);
		});
	});
});
