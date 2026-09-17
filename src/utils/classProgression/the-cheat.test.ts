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
import { REPORT, UNDERHANDED_ABILITIES_OPTIONS } from './the-cheat.expect.ts';

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

describe('The Cheat - pack data', () => {
	const { feature, rulesOf, effectsOf } = packFeatureHelpers(CLASS_ID);

	describe('Cheat!', () => {
		it('ships one favourable skill-check roll-mode rule for games, competitions and wagers', () => {
			const rules = rulesOf('Cheat!', 'situationalRollMode');
			expect(rules).toHaveLength(1);
			const [rule] = rules;
			expect(rule.label).toBe('Playing a game, competing, or placing a wager');
			expect(rule.checkType).toBe('skillCheck');
			expect(rule.value).toBe(1);
			expect(rule.skills).toEqual(['all']);
			expect(rule.saves).toEqual([]);
			expect(rule.abilities).toEqual([]);
			expect(rule.disabled).toBe(false);
		});

		it('ships one charge pool that refreshes each round and again when the encounter ends', () => {
			const pools = rulesOf('Cheat!', 'chargePool');
			expect(pools).toHaveLength(1);
			const [pool] = pools;
			expect(pool.identifier).toBe('cheat-free-move-or-hide');
			expect(pool.scope).toBe('item');
			expect(pool.max).toBe('1');
			expect(pool.initial).toBe('max');
			expect(pool.hidden).toBe(true);
			expect(pool.disabled).toBe(false);
			expect(pool.recoveries).toEqual([
				{ trigger: 'onTurnStart', mode: 'refresh', value: '1' },
				{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
			]);
		});

		it('ships a consumer that spends one charge from that pool', () => {
			const consumers = rulesOf('Cheat!', 'chargeConsumer');
			expect(consumers).toHaveLength(1);
			const [consumer] = consumers;
			expect(consumer.poolIdentifier).toBe('cheat-free-move-or-hide');
			expect(consumer.poolScope).toBe('item');
			expect(consumer.costMode).toBe('fixed');
			expect(consumer.cost).toBe('1');
			expect(consumer.disabled).toBe(false);
		});

		it('ships one action delta that gives the Cheat 1 action now', () => {
			const deltas = rulesOf('Cheat!', 'actionDelta');
			expect(deltas).toHaveLength(1);
			const [delta] = deltas;
			expect(delta.target).toBe('self');
			expect(delta.value).toBe('1');
			expect(delta.timing).toBe('now');
			expect(delta.borrowFromNextTurn).toBe(false);
			expect(delta.disabled).toBe(false);
		});

		it('ships reminders for the action limit and the two parts the player applies by hand', () => {
			const notes = effectsOf('Cheat!', 'note');
			expect(notes.map((note) => [note.noteType, note.text])).toEqual([
				['reminder', 'Spend the extra action on a Move or a Hide only.'],
				['reminder', '1/day: you may change any skill check to 10+INT.'],
				['reminder', 'If you roll under 10 on Initiative, you may change it to 10.'],
			]);
		});
	});

	describe('Sweet Talk', () => {
		it('ships two influence roll-mode rules, one favourable and one not', () => {
			const rules = rulesOf('Sweet Talk', 'situationalRollMode');
			expect(rules).toHaveLength(2);
			for (const rule of rules) {
				expect(rule.checkType).toBe('skillCheck');
				expect(rule.skills).toEqual(['influence']);
				expect(rule.disabled).toBe(false);
			}
			expect(rules.map((rule) => rule.value).sort((a, b) => a - b)).toEqual([-1, 1]);
			const byValue = Object.fromEntries(rules.map((rule) => [rule.value, rule.label]));
			expect(byValue[1]).toBe(
				'An NPC you have just met (until you fail a check with them or meet again)',
			);
			expect(byValue[-1]).toBe(
				'An NPC you already Sweet Talked (until you get back on their good side)',
			);
		});
	});

	describe('Underhanded Abilities', () => {
		it('ships a description that lists every pick up to level 18', () => {
			const description = feature('Underhanded Abilities').system.description;
			expect(description).toBe(
				'<p>Choose an Underhanded Ability.</p><hr><p>Level 6: Choose a 2nd Underhanded Ability.</p><p>Level 8: Choose a 3rd Underhanded Ability.</p><p>Level 10: Choose a 4th Underhanded Ability.</p><p>Level 12: Choose a 5th Underhanded Ability.</p><p>Level 14: Choose a 6th Underhanded Ability.</p><p>Level 16: Choose a 7th Underhanded Ability.</p><p>Level 18: Choose an 8th Underhanded Ability.</p>',
			);
		});
	});
});
