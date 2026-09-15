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
import { REPORT } from './songweaver.expect.ts';

/**
 * Integration test for the Songweaver class level-up progression.
 *
 * Drives the REAL feature resolver against the on-disk compendium data and
 * compares the results to the human-facing expectation report. Songweaver is a
 * caster with three selectable groups: `songweaver-progression` (auto grants +
 * #708 option features), `lyrical-weaponry`, and `a-people-person`.
 */

const CLASS_ID = 'songweaver';

// Report uses short ability tokens (WILL / INT / STR); the class definition
// stores the full ability keys. Map the class keys onto the report's tokens so
// the two can be compared directly.
const ABILITY_TOKEN: Record<string, string> = {
	strength: 'STR',
	dexterity: 'DEX',
	constitution: 'CON',
	intelligence: 'INT',
	will: 'WILL',
	wisdom: 'WIS',
	charisma: 'CHA',
};

function toToken(ability: string): string {
	return ABILITY_TOKEN[ability.toLowerCase()] ?? ability.toUpperCase();
}

/** Slugify a report group display name into a feature `group` identifier. */
function slug(name: string): string {
	return (name as unknown as { slugify(opts?: { strict?: boolean }): string }).slugify();
}

/** Effective auto set the player sees at a level: real grants + #708 option features. */
function effectiveAuto(summary: LevelSummary): string[] {
	return [...summary.newAutoGrants, ...summary.optionFeatureNames];
}

describe('Songweaver progression (real resolver)', () => {
	let index: ClassFeatureIndex;
	let summaries: LevelSummary[];

	beforeAll(async () => {
		index = await buildRealIndex();
		summaries = await simulateProgression(index, CLASS_ID);
	});

	afterAll(() => {
		restoreMocks();
	});

	describe('creation (level 1) & class metadata', () => {
		it('matches the report identity, hit die, and starting HP', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.name).toBe(REPORT.name);
			expect(meta.identifier).toBe(REPORT.id);
			expect(meta.hitDieSize).toBe(REPORT.hitDie);
			expect(meta.startingHp).toBe(REPORT.startingHp);
		});

		it('matches key ability scores and saving throws', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.keyAbilityScores.map(toToken)).toEqual(REPORT.keyAbilities);
			expect(toToken(meta.savingThrows.advantage)).toBe(REPORT.savingThrows.adv);
			expect(toToken(meta.savingThrows.disadvantage)).toBe(REPORT.savingThrows.dis);
		});

		it('matches starting gear', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.startingGear).toEqual(REPORT.startingGear);
		});

		it('is a caster with the reported mana formula', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.caster).toBe(true);
			expect(REPORT.caster).toBe(true);
			expect(meta.manaFormula).toBe(REPORT.manaFormula);
		});

		it('auto-grants exactly the level 1 features (creation)', () => {
			const l1 = summaries[0];
			expect(l1.level).toBe(1);
			// Level 1 features are plain auto-grants, no option features.
			expect(l1.newAutoGrants.sort()).toEqual([...REPORT.levels[0].auto].sort());
			expect(l1.optionFeatureNames).toEqual([]);
			expect(Object.keys(l1.offeredGroups)).toEqual([]);
		});
	});

	describe('per-level auto grants (2 -> 20)', () => {
		// Earliest report level at which each auto feature is expected to appear.
		const firstReportLevel = new Map<string, number>();
		for (const lvl of REPORT.levels) {
			for (const name of lvl.auto) {
				if (!firstReportLevel.has(name)) firstReportLevel.set(name, lvl.level);
			}
		}

		it.each(REPORT.levels)('level $level grants the expected features', (rl) => {
			const summary = summaries[rl.level - 1];
			const eff = effectiveAuto(summary);
			for (const name of rl.auto) {
				const first = firstReportLevel.get(name);
				if (first === rl.level) {
					// First time the report lists it -> the real system grants it now.
					expect(eff).toContain(name);
				} else {
					// A repeat listing (e.g. "Mana and Unlock Tier 1 Spells"): the real
					// system must NOT re-grant it as a fresh auto-grant.
					expect(summary.newAutoGrants).not.toContain(name);
				}
			}
		});
	});

	describe('#708 option features & selectable pools', () => {
		it.each(REPORT.levels)('level $level offers exactly the reported pools', (rl) => {
			const summary = summaries[rl.level - 1];
			const expectedGroups = rl.pools.map((p) => slug(p.group)).sort();
			expect(Object.keys(summary.offeredGroups).sort()).toEqual(expectedGroups);

			for (const pool of rl.pools) {
				const key = slug(pool.group);
				const offered = summary.offeredGroups[key];
				expect(offered, `group ${key} offered at level ${rl.level}`).toBeDefined();
				// A pool must ask for at least one pick and provide at least that many.
				expect(offered.selectionCount).toBeGreaterThanOrEqual(1);
				expect(offered.options.length).toBeGreaterThanOrEqual(offered.selectionCount);
				// Every offered option must be a known member of the reported pool.
				for (const opt of offered.options) {
					expect(pool.options).toContain(opt);
				}
			}
		});

		it('offers lyrical-weaponry at levels 4, 9, 13, 17', () => {
			for (const level of [4, 9, 13, 17]) {
				const offered = summaries[level - 1].offeredGroups['lyrical-weaponry'];
				expect(offered, `lyrical-weaponry at level ${level}`).toBeDefined();
				expect(offered.selectionCount).toBeGreaterThanOrEqual(1);
				expect(offered.options.length).toBeGreaterThanOrEqual(offered.selectionCount);
			}
		});

		it('offers a-people-person at level 5, letting the player choose 2 companions', () => {
			// Rulebook: "A 'People' Person ... Choose 2 friends you know." The option's
			// selectionCount must be 2 (the companions' selectionCountByLevel {"5":2} is dead
			// data here because the group is presented through the #708 option picker).
			const offered = summaries[4].offeredGroups['a-people-person'];
			expect(offered).toBeDefined();
			expect(offered.selectionCount).toBe(2);
			expect(offered.options.length).toBeGreaterThanOrEqual(4);

			const option = summaries[4].offeredOptions.find((o) =>
				o.selectionGroups.includes('a-people-person'),
			);
			expect(option?.selectionCount).toBe(2);
		});

		it('surfaces the "Lyrical Weaponry" and "A People Person" progression features as option features', () => {
			expect(summaries[3].optionFeatureNames).toContain('Lyrical Weaponry');
			expect(summaries[4].optionFeatureNames).toContain('A People Person');
		});
	});

	describe('ability score increases', () => {
		it.each(REPORT.levels)('level $level ASI matches the report', (rl) => {
			expect(summaries[rl.level - 1].asi).toBe(rl.asi);
		});
	});

	describe('subclass metadata (selection out of scope)', () => {
		it('has the reported number of subclass groups', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.subclassGroups.length).toBe(REPORT.subclasses.length);
		});

		it('first selects a subclass at the reported level', () => {
			const meta = getClassMeta(CLASS_ID);
			expect(meta.subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
			expect(summaries[REPORT.subclassSelectLevel - 1].isSubclassSelectLevel).toBe(true);
		});
	});

	describe('data integrity', () => {
		it('produces exactly 20 level summaries', () => {
			expect(summaries).toHaveLength(20);
			expect(summaries.map((s) => s.level)).toEqual(Array.from({ length: 20 }, (_v, i) => i + 1));
		});

		it('never auto-grants the same feature twice across the progression', () => {
			const seen = new Set<string>();
			for (const summary of summaries) {
				for (const name of summary.newAutoGrants) {
					expect(seen.has(name), `"${name}" auto-granted more than once`).toBe(false);
					seen.add(name);
				}
			}
		});

		it('the union of real grants equals the union of reported auto features', () => {
			const real = new Set<string>();
			for (const summary of summaries) for (const n of effectiveAuto(summary)) real.add(n);
			const reported = new Set<string>();
			for (const lvl of REPORT.levels) for (const n of lvl.auto) reported.add(n);
			expect([...real].sort()).toEqual([...reported].sort());
		});

		it('every offered pool provides at least as many options as required picks', () => {
			for (const summary of summaries) {
				for (const [group, offered] of Object.entries(summary.offeredGroups)) {
					expect(
						offered.options.length,
						`group ${group} at level ${summary.level} has too few options`,
					).toBeGreaterThanOrEqual(offered.selectionCount);
				}
			}
		});
	});
});

describe('Songweaver - pack data', () => {
	const { feature, rulesOf, effectsOf, costOf } = packFeatureHelpers(CLASS_ID);

	describe('Inspiring Anthem', () => {
		it('ships one charge pool that refreshes at the start of each encounter', () => {
			const pools = rulesOf('Inspiring Anthem', 'chargePool');
			expect(pools).toHaveLength(1);
			const [pool] = pools;
			expect(pool.identifier).toBe('inspiring-anthem-encounter');
			expect(pool.scope).toBe('item');
			expect(pool.max).toBe('1');
			expect(pool.initial).toBe('max');
			expect(pool.disabled).toBe(false);
			expect(pool.recoveries).toEqual([{ trigger: 'encounterStart', mode: 'refresh', value: '1' }]);
		});

		it('ships a consumer that spends one charge from that pool', () => {
			const consumers = rulesOf('Inspiring Anthem', 'chargeConsumer');
			expect(consumers).toHaveLength(1);
			const [consumer] = consumers;
			expect(consumer.poolIdentifier).toBe('inspiring-anthem-encounter');
			expect(consumer.poolScope).toBe('item');
			expect(consumer.costMode).toBe('fixed');
			expect(consumer.cost).toBe('1');
			expect(consumer.disabled).toBe(false);
		});

		it('ships one action delta that gives the targeted creature 1 action now', () => {
			const deltas = rulesOf('Inspiring Anthem', 'actionDelta');
			expect(deltas).toHaveLength(1);
			const [delta] = deltas;
			expect(delta.target).toBe('targeted');
			expect(delta.value).toBe('1');
			expect(delta.timing).toBe('now');
			expect(delta.borrowFromNextTurn).toBe(false);
			expect(delta.disabled).toBe(false);
		});

		it('ships one healing node aimed at friendly creatures', () => {
			const healing = effectsOf('Inspiring Anthem', 'healing');
			expect(healing).toHaveLength(1);
			const [node] = healing;
			expect(node.healingType).toBe('healing');
			expect(node.formula).toBe('1');
			expect(node.targetDisposition).toBe('friendly');
		});
	});

	describe.each([
		{ name: 'Stompy', poolIdentifier: 'stompy-uses', actions: 3 },
		{ name: 'Gran Gran (NOT a hag)', poolIdentifier: 'gran-gran-uses', actions: 1 },
		{ name: 'Linos, the Everfriendly', poolIdentifier: 'linos-uses', actions: 1 },
		{ name: 'Mal, the Malevolent Imp', poolIdentifier: 'mal-uses', actions: 1 },
	])('$name', ({ name, poolIdentifier, actions }) => {
		it('ships one charge pool that refreshes on a Safe Rest', () => {
			const pools = rulesOf(name, 'chargePool');
			expect(pools).toHaveLength(1);
			const [pool] = pools;
			expect(pool.identifier).toBe(poolIdentifier);
			expect(pool.scope).toBe('item');
			expect(pool.max).toBe('1');
			expect(pool.initial).toBe('max');
			expect(pool.disabled).toBe(false);
			expect(pool.recoveries).toEqual([{ trigger: 'safeRest', mode: 'refresh', value: '1' }]);
		});

		it('ships a consumer that spends one charge from that pool', () => {
			const consumers = rulesOf(name, 'chargeConsumer');
			expect(consumers).toHaveLength(1);
			const [consumer] = consumers;
			expect(consumer.poolIdentifier).toBe(poolIdentifier);
			expect(consumer.poolScope).toBe('item');
			expect(consumer.costMode).toBe('fixed');
			expect(consumer.cost).toBe('1');
			expect(consumer.disabled).toBe(false);
		});

		it('keeps the action cost the book prints', () => {
			expect(costOf(name).quantity).toBe(actions);
		});
	});

	describe('Mal, the Malevolent Imp', () => {
		it('ships two influence roll-mode rules, one favourable and one not', () => {
			const rules = rulesOf('Mal, the Malevolent Imp', 'situationalRollMode');
			expect(rules).toHaveLength(2);
			for (const rule of rules) {
				expect(rule.checkType).toBe('skillCheck');
				expect(rule.skills).toEqual(['influence']);
				expect(rule.disabled).toBe(false);
			}
			expect(rules.map((rule) => rule.value).sort((a, b) => a - b)).toEqual([-1, 1]);
		});
	});

	describe('Chorus of Champions', () => {
		it('ships one charge pool that refreshes at the start of each encounter', () => {
			const pools = rulesOf('Chorus of Champions', 'chargePool');
			expect(pools).toHaveLength(1);
			const [pool] = pools;
			expect(pool.identifier).toBe('chorus-of-champions-encounter');
			expect(pool.scope).toBe('item');
			expect(pool.max).toBe('1');
			expect(pool.initial).toBe('max');
			expect(pool.disabled).toBe(false);
			expect(pool.recoveries).toEqual([{ trigger: 'encounterStart', mode: 'refresh', value: '1' }]);
		});

		it('ships a consumer that spends one charge from that pool', () => {
			const consumers = rulesOf('Chorus of Champions', 'chargeConsumer');
			expect(consumers).toHaveLength(1);
			const [consumer] = consumers;
			expect(consumer.poolIdentifier).toBe('chorus-of-champions-encounter');
			expect(consumer.poolScope).toBe('item');
			expect(consumer.costMode).toBe('fixed');
			expect(consumer.cost).toBe('1');
			expect(consumer.disabled).toBe(false);
		});

		it('gives every ally 1 action now', () => {
			const deltas = rulesOf('Chorus of Champions', 'actionDelta');
			expect(deltas).toHaveLength(2);
			expect(deltas.map((delta) => delta.target).sort()).toEqual(['allAllies', 'self']);
			for (const delta of deltas) {
				expect(delta.value).toBe('1');
				expect(delta.timing).toBe('now');
				expect(delta.borrowFromNextTurn).toBe(false);
				expect(delta.disabled).toBe(false);
			}
		});

		it('costs a free reaction', () => {
			const cost = costOf('Chorus of Champions');
			expect(cost.type).toBe('action');
			expect(cost.quantity).toBe(0);
			expect(cost.isReaction).toBe(true);
		});
	});

	describe.each(['A People Person', 'Lyrical Weaponry'])('%s', (name) => {
		it('ships a description', () => {
			expect(feature(name).system.description.trim()).not.toBe('');
		});
	});

	describe.each([
		"I'm So Famous!",
		'Mana and Unlock Tier 1 Spells',
		'Quick Wit',
		'Song of Rest',
		'Windbag',
	])('%s', (name) => {
		it('is not a reaction', () => {
			expect(costOf(name).isReaction).toBe(false);
			expect(costOf(name).details).toBe('');
		});
	});

	describe('Opportunistic Snark', () => {
		it('is a reaction that costs its action', () => {
			expect(costOf('Opportunistic Snark')).toMatchObject({
				type: 'action',
				quantity: 1,
				isReaction: true,
			});
		});
	});

	describe("Songweaver's Inspiration", () => {
		it('is a free reaction', () => {
			expect(costOf("Songweaver's Inspiration")).toMatchObject({
				type: 'action',
				quantity: 0,
				isReaction: true,
			});
		});
	});
});
