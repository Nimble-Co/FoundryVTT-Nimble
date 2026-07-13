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
 * Integration test for the Songweaver class level-up progression.
 *
 * Drives the REAL feature resolver against the on-disk compendium data and
 * compares the results to the human-facing expectation report. Songweaver is a
 * caster with three selectable groups: `songweaver-progression` (auto grants +
 * #708 option features), `lyrical-weaponry`, and `a-people-person`.
 */

const CLASS_ID = 'songweaver';

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

// Embedded copy of expectations/songweaver.json (source of truth).
const REPORT: Report = {
	name: 'Songweaver',
	id: 'songweaver',
	hitDie: 8,
	startingHp: 13,
	keyAbilities: ['WILL', 'INT'],
	savingThrows: {
		adv: 'WILL',
		dis: 'STR',
	},
	startingGear: ["Adventurer's Garb", 'Instrument', 'Dagger', 'Mirror'],
	caster: true,
	manaFormula: '(max(@intelligence, 0) * 3) + @level',
	levels: [
		{
			level: 1,
			auto: ["Songweaver's Inspiration", 'Wind Spellcasting and...'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 2,
			auto: ['Jack of All Trades', 'Mana and Unlock Tier 1 Spells', 'Song of Rest'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Quick Wit', 'Windbag'],
			pools: [],
			subclass: [
				{
					group: 'Herald Of Courage',
					options: ['Inspiring Presence'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Opportunistic Snark'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Lyrical Weaponry', 'Mana and Unlock Tier 1 Spells'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['A People Person'],
			pools: [
				{
					group: 'A People Person',
					options: [
						'Gran Gran (NOT a hag)',
						'Linos, the Everfriendly',
						'Mal, the Malevolent Imp',
						'Stompy',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 7,
			auto: [],
			pools: [],
			subclass: [
				{
					group: 'Herald Of Courage',
					options: ['Unfailing Courage'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Fight Picker'],
				},
			],
			asi: null,
		},
		{
			level: 8,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 9,
			auto: ['Lyrical Weaponry'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
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
				{
					group: 'Herald Of Courage',
					options: ['Fire in my Bones'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Chord of Chaos'],
				},
			],
			asi: null,
		},
		{
			level: 12,
			auto: ['Mana and Unlock Tier 1 Spells'],
			pools: [],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 13,
			auto: ['Lyrical Weaponry'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
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
				{
					group: 'Herald Of Courage',
					options: ['Chorus of Champions'],
				},
				{
					group: 'Herald Of Snark',
					options: ['Words Like Swords'],
				},
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
			auto: ['Lyrical Weaponry'],
			pools: [
				{
					group: 'Lyrical Weaponry',
					options: [
						'Heroic Ballad',
						'Inspiring Anthem',
						'Not My Beautiful Faaace!',
						'Rhapsody of the Normal',
						'Song of Domination',
					],
				},
			],
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
		{
			level: 19,
			auto: [],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 20,
			auto: ["I'm So Famous!"],
			pools: [],
			subclass: [],
			asi: 'capstone',
		},
	],
	subclasses: ['Herald Of Courage', 'Herald Of Snark'],
	subclassSelectLevel: 3,
};

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
