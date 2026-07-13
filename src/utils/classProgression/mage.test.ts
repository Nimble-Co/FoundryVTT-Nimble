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
 * Integration test for the Mage class level-up progression.
 *
 * Drives the REAL feature resolver via the shared harness and compares its output
 * against the human-facing expectation report (`expectations/mage.json`). Mage is a
 * spellcaster: it repeatedly lists "Mana and Unlock Tier 1 Spells" and exposes the
 * #708 "Spell Shaper" option feature backing the `spellshaper` pool.
 */

const CLASS_ID = 'mage';

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

// Embedded copy of expectations/mage.json (source of truth).
const REPORT: Report = {
	name: 'Mage',
	id: 'mage',
	hitDie: 6,
	startingHp: 10,
	keyAbilities: ['INT', 'WILL'],
	savingThrows: {
		adv: 'INT',
		dis: 'STR',
	},
	startingGear: ["Adventurer's Garb", 'Staff', 'Soap'],
	caster: true,
	manaFormula: '(max(@intelligence, 0) * 3) + @level',
	levels: [
		{
			level: 1,
			auto: ['Elemental Spellcasting'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 2,
			auto: ['Mana and Unlock Tier 1 Spells', 'Talented Researcher'],
			pools: [],
			subclass: [],
			asi: null,
		},
		{
			level: 3,
			auto: ['Elemental Mastery'],
			pools: [],
			subclass: [
				{
					group: 'Invoker Of Chaos',
					options: ['Force of Chaos'],
				},
				{
					group: 'Invoker Of Control',
					options: ['Deny Fate', 'Force of Will'],
				},
			],
			asi: null,
		},
		{
			level: 4,
			auto: ['Mana and Unlock Tier 1 Spells', 'Spell Shaper'],
			pools: [
				{
					group: 'Spellshaper',
					options: [
						'Dimensional Compression',
						'Echo Casting',
						'Elemental Destruction',
						'Elemental Transmutation',
						'Extra-Dimensional Vision',
						'Methodical Spellweaver',
						'Precise Casting',
						'Stretch Time',
					],
				},
			],
			subclass: [],
			asi: 'primary',
		},
		{
			level: 5,
			auto: ['Elemental Surge'],
			pools: [],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 6,
			auto: ['Elemental Mastery', 'Mana and Unlock Tier 1 Spells'],
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
					group: 'Invoker Of Chaos',
					options: ['Chaos Lash', 'Tempest Mage'],
				},
				{
					group: 'Invoker Of Control',
					options: ['At Any Cost', 'Nullify'],
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
			auto: ['Spell Shaper'],
			pools: [
				{
					group: 'Spellshaper',
					options: [
						'Dimensional Compression',
						'Echo Casting',
						'Elemental Destruction',
						'Elemental Transmutation',
						'Extra-Dimensional Vision',
						'Methodical Spellweaver',
						'Precise Casting',
						'Stretch Time',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 10,
			auto: ['Elemental Surge', 'Mana and Unlock Tier 1 Spells'],
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
					group: 'Invoker Of Chaos',
					options: ['Thrive in Chaos'],
				},
				{
					group: 'Invoker Of Control',
					options: ['Steel Will'],
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
			auto: ['Spell Shaper'],
			pools: [
				{
					group: 'Spellshaper',
					options: [
						'Dimensional Compression',
						'Echo Casting',
						'Elemental Destruction',
						'Elemental Transmutation',
						'Extra-Dimensional Vision',
						'Methodical Spellweaver',
						'Precise Casting',
						'Stretch Time',
					],
				},
			],
			subclass: [],
			asi: 'secondary',
		},
		{
			level: 14,
			auto: ['Elemental Mastery', 'Mana and Unlock Tier 1 Spells'],
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
					group: 'Invoker Of Chaos',
					options: ['Master of Chaos'],
				},
				{
					group: 'Invoker Of Control',
					options: ['Supreme Control'],
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
			auto: ['Elemental Surge'],
			pools: [],
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
			auto: ['Archmage'],
			pools: [],
			subclass: [],
			asi: 'capstone',
		},
	],
	subclasses: ['Invoker Of Chaos', 'Invoker Of Control'],
	subclassSelectLevel: 3,
};

// The class data stores ability scores as full lowercase names; the report uses
// short uppercase codes. Normalize the class data to the report's vocabulary.
const ABILITY_CODE: Record<string, string> = {
	strength: 'STR',
	dexterity: 'DEX',
	constitution: 'CON',
	intelligence: 'INT',
	wisdom: 'WIS',
	will: 'WILL',
	charisma: 'CHA',
};

const norm = (s: string) => s.trim().toLowerCase();

let index: ClassFeatureIndex;
let summaries: LevelSummary[];

beforeAll(async () => {
	index = await buildRealIndex();
	summaries = await simulateProgression(index, CLASS_ID);
});

afterAll(() => {
	restoreMocks();
});

describe('Mage — class creation (L1) & metadata', () => {
	it('exposes the identity metadata the report claims', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.name).toBe(REPORT.name);
		expect(meta.identifier).toBe(REPORT.id);
		expect(meta.hitDieSize).toBe(REPORT.hitDie);
		expect(meta.startingHp).toBe(REPORT.startingHp);
	});

	it('maps key ability scores to the report codes', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.keyAbilityScores.map((a) => ABILITY_CODE[a])).toEqual(REPORT.keyAbilities);
	});

	it('has the reported saving-throw advantage / disadvantage', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(ABILITY_CODE[meta.savingThrows.advantage]).toBe(REPORT.savingThrows.adv);
		expect(ABILITY_CODE[meta.savingThrows.disadvantage]).toBe(REPORT.savingThrows.dis);
	});

	it('grants the reported starting gear', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.startingGear).toEqual(REPORT.startingGear);
	});

	it('is a spellcaster with the reported mana formula', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.caster).toBe(true);
		expect(REPORT.caster).toBe(true);
		expect(meta.manaFormula).toBe(REPORT.manaFormula);
	});

	it('auto-grants exactly Elemental Spellcasting at level 1', () => {
		const l1 = summaries[0];
		expect(l1.level).toBe(1);
		expect(l1.newAutoGrants).toEqual(['Elemental Spellcasting']);
		expect(l1.optionFeatureNames).toEqual([]);
		expect(Object.keys(l1.offeredGroups)).toEqual([]);
	});
});

describe('Mage — subclass', () => {
	it('selects a subclass at the reported level', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.subclassSelectLevel).toBe(REPORT.subclassSelectLevel);
	});

	it('has one subclass group per reported subclass', () => {
		const meta = getClassMeta(CLASS_ID);
		expect(meta.subclassGroups.length).toBe(REPORT.subclasses.length);
	});
});

describe('Mage — data integrity', () => {
	it('produces one summary per level (1..20)', () => {
		expect(summaries).toHaveLength(20);
		expect(summaries.map((s) => s.level)).toEqual(Array.from({ length: 20 }, (_v, i) => i + 1));
	});

	it('never auto-grants the same feature twice (owned-forwarding holds)', () => {
		const counts = new Map<string, number>();
		for (const s of summaries) {
			for (const name of s.newAutoGrants) {
				counts.set(name, (counts.get(name) ?? 0) + 1);
			}
		}
		const doubled = [...counts.entries()].filter(([, n]) => n > 1);
		expect(doubled).toEqual([]);
	});

	it('grants the repeated "Mana and Unlock Tier 1 Spells" exactly once (at L2)', () => {
		const grantLevels = summaries
			.filter((s) => s.newAutoGrants.includes('Mana and Unlock Tier 1 Spells'))
			.map((s) => s.level);
		expect(grantLevels).toEqual([2]);
	});

	it('every offered pool has at least as many options as its selection count', () => {
		for (const s of summaries) {
			for (const [group, pool] of Object.entries(s.offeredGroups)) {
				expect(pool.selectionCount, `L${s.level} ${group} count`).toBeGreaterThanOrEqual(1);
				expect(
					pool.options.length,
					`L${s.level} ${group} options(${pool.options.length}) >= count(${pool.selectionCount})`,
				).toBeGreaterThanOrEqual(pool.selectionCount);
			}
		}
	});
});

describe('Mage — ASI matches the report at every level', () => {
	for (const rl of REPORT.levels) {
		it(`level ${rl.level} ASI = ${rl.asi ?? 'none'}`, () => {
			expect(summaries[rl.level - 1].asi).toBe(rl.asi);
		});
	}
});

describe('Mage — auto grants (union semantics: newAutoGrants ∪ optionFeatures)', () => {
	// Names the resolver surfaces as #708 option features (computed lazily at test
	// time — `summaries` is not populated until beforeAll runs).
	const optionUnion = () => new Set(summaries.flatMap((s) => s.optionFeatureNames));

	it('overall auto union equals report auto union', () => {
		const reportAuto = new Set(REPORT.levels.flatMap((l) => l.auto));
		const resolverAuto = new Set([
			...summaries.flatMap((s) => s.newAutoGrants),
			...summaries.flatMap((s) => s.optionFeatureNames),
		]);
		expect([...resolverAuto].sort()).toEqual([...reportAuto].sort());
	});

	it('the only #708 option feature surfaced is "Spell Shaper", at levels 4/9/13', () => {
		const optLevels = summaries.filter((s) => s.optionFeatureNames.length > 0).map((s) => s.level);
		expect(optLevels).toEqual([4, 9, 13]);
		expect([...optionUnion()]).toEqual(['Spell Shaper']);
	});

	// Per-level auto verification honoring owned-forwarding of repeated features.
	const firstReportLevel = new Map<string, number>();
	for (const rl of REPORT.levels) {
		for (const name of rl.auto) {
			if (!firstReportLevel.has(name)) firstReportLevel.set(name, rl.level);
		}
	}

	for (const rl of REPORT.levels) {
		it(`level ${rl.level} auto entries resolve correctly`, () => {
			const s = summaries[rl.level - 1];
			const opts = optionUnion();
			for (const name of rl.auto) {
				if (opts.has(name)) {
					// Option features surface every listed level via the picker.
					expect(s.optionFeatureNames, `L${rl.level} option ${name}`).toContain(name);
				} else if (firstReportLevel.get(name) === rl.level) {
					// First appearance: must be freshly auto-granted.
					expect(s.newAutoGrants, `L${rl.level} first-grant ${name}`).toContain(name);
				} else {
					// Repeat appearance: already owned, must NOT be re-granted.
					expect(s.newAutoGrants, `L${rl.level} no re-grant ${name}`).not.toContain(name);
				}
			}
		});
	}
});

describe('Mage — pools match the report (case-insensitive group match)', () => {
	for (const rl of REPORT.levels) {
		if (rl.pools.length === 0) {
			it(`level ${rl.level} offers no pools`, () => {
				expect(Object.keys(summaries[rl.level - 1].offeredGroups)).toEqual([]);
			});
			continue;
		}

		for (const pool of rl.pools) {
			it(`level ${rl.level} offers the "${pool.group}" pool`, () => {
				const offered = summaries[rl.level - 1].offeredGroups;
				const key = Object.keys(offered).find((k) => norm(k) === norm(pool.group));
				expect(key, `L${rl.level} group ${pool.group} present`).toBeDefined();
				const resolved = offered[key as string];
				expect(resolved.selectionCount).toBeGreaterThanOrEqual(1);
				expect(resolved.options.length).toBeGreaterThanOrEqual(resolved.selectionCount);
			});
		}
	}

	it('the Spellshaper pool at L4 offers all 8 reported abilities with count 2', () => {
		const l4 = summaries[3];
		const key = Object.keys(l4.offeredGroups).find((k) => norm(k) === 'spellshaper');
		expect(key).toBeDefined();
		const pool = l4.offeredGroups[key as string];
		expect(pool.selectionCount).toBe(2);
		const reportPool = REPORT.levels[3].pools.find((p) => norm(p.group) === 'spellshaper');
		expect([...pool.options].sort()).toEqual([...(reportPool?.options ?? [])].sort());
	});
});
