import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import type { ResultCardView } from '../../../utils/incomingReactions/incomingReactionEntry.js';
import type { RollToReroll } from '../../../utils/reroll/rollToReroll.js';
import { ChangeResultRule } from '../changeResult.js';
import { ModifyRerollRule } from '../modifyReroll.js';
import { RerollRule } from '../reroll.js';

const FEATURES = 'packs/classFeatures/core';
const BACKGROUNDS = 'packs/backgrounds/core';

const ELUSIVE = 'packs/ancestryBonuses/core/common/elusive.json';
const STEEL_WILL = `${FEATURES}/mage/mage-subclasses/invoker-of-control/steel-will.json`;
const KNOWLEDGE = `${FEATURES}/shadowmancer/lesser-invocations/knowledge-from-beyond.json`;
const EPIC_RESISTANCE = 'packs/boons/core/epic/epic-resistance.json';
const FAMOUS = `${FEATURES}/songweaver/songweaver-progression/im-so-famous.json`;
const INSPIRATION = `${FEATURES}/songweaver/songweaver-progression/songweavers-inspiration.json`;
const MIGHTY_SOUL = `${FEATURES}/zephyr/martial-arts-ability/mighty-soul.json`;
const CHEAT = `${FEATURES}/the-cheat/the-cheat-progression/cheat.json`;
const BUMBLEWISE = `${BACKGROUNDS}/bumblewise.json`;
const WILY = `${BACKGROUNDS}/wily-underdog.json`;
const ACROBAT = `${BACKGROUNDS}/accidental-acrobat.json`;
const SO_DUMB = `${BACKGROUNDS}/so-dumb-im-smart-sometimes.json`;
const CUNNING_STRIKE = `${FEATURES}/the-cheat/the-cheat-subclasses/tools-of-the-silent-blade/cunning-strike.json`;

const FILES = [
	ELUSIVE,
	STEEL_WILL,
	KNOWLEDGE,
	EPIC_RESISTANCE,
	FAMOUS,
	MIGHTY_SOUL,
	CHEAT,
	BUMBLEWISE,
	WILY,
	ACROBAT,
	SO_DUMB,
];

type RuleData = Record<string, unknown> & { type: string; id: string };
type Choices = Record<string, string> | string[] | (() => unknown);
type FieldLike = { choices?: Choices; element?: { choices?: Choices } };

function readItem(file: string) {
	return JSON.parse(readFileSync(resolve(file), 'utf8'));
}

function packRules(file: string): RuleData[] {
	return readItem(file).system.rules as RuleData[];
}

function rulesOfType(file: string, type: string): RuleData[] {
	return packRules(file).filter((rule) => rule.type === type);
}

function ruleOfType(file: string, type: string, change?: string): RuleData {
	const rule = rulesOfType(file, type).find(
		(candidate) => change === undefined || candidate.change === change,
	);
	if (!rule) throw new Error(`${file} has no ${type} rule ${change ?? ''}`);
	return rule;
}

function liveRule<T extends ChangeResultRule | RerollRule>(
	RuleClass: new (...args: never[]) => T,
	data: RuleData,
): T {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
		getRollData: () => ({}),
		items: [],
		system: { attributes: { wounds: { value: 0, max: 6 } } },
	};
	const item = {
		isEmbedded: true,
		actor,
		name: 'Pack item',
		uuid: 'Actor.hero.Item.pack',
		getDomain: () => new Set<string>(),
	};
	const rule = new RuleClass(
		{ type: data.type } as never,
		{
			parent: item,
			strict: false,
		} as never,
	);
	Object.assign(rule, {
		...data,
		otherCreature: new Predicate((data.otherCreature ?? {}) as never),
		predicate: new Predicate((data.predicate ?? {}) as never),
		// The charge gate has its own tests. These test what the items ask for.
		chargePoolIdentifier: '',
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

const SAVE = (key: string): RollToReroll => ({ kind: 'save', key });
const SKILL = (key: string): RollToReroll => ({ kind: 'skillCheck', key });
const ATTACK = (...stats: string[]): RollToReroll => ({ kind: 'attack', delivery: 'melee', stats });
const INITIATIVE: RollToReroll = { kind: 'initiative', key: 'initiative' };

const roller = { getRollData: () => ({ strength: 3, intelligence: 2 }) };
const card = (total: number, result?: 'failed' | 'succeeded'): ResultCardView => ({
	total,
	changes: [],
	roller,
	...(result ? { result } : {}),
});

function offersOnRoll(
	rule: ChangeResultRule | RerollRule,
	roll: RollToReroll,
	view?: ResultCardView,
) {
	return rule.offersUseOn({ side: 'roller', roll, ...(view ? { card: view } : {}) });
}

describe('the pack items of check outcomes', () => {
	describe('Elusive', () => {
		it('keeps its Stealth bonus, and succeeds on a failed save from a pool of 1/Safe Rest', () => {
			expect(ruleOfType(ELUSIVE, 'skillBonus')).toMatchObject({ value: '+1', skills: ['stealth'] });
			const data = ruleOfType(ELUSIVE, 'changeResult');
			expect(data).toMatchObject({
				change: 'succeed',
				rolls: ['save'],
				outcome: 'failed',
				usedBy: 'roller',
				chargePoolIdentifier: 'elusive',
			});
			const rule = liveRule(ChangeResultRule, data);
			expect(offersOnRoll(rule, SAVE('will'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, SAVE('will'), card(20, 'succeeded'))).toBe(false);
			expect(offersOnRoll(rule, SKILL('might'), card(5, 'failed'))).toBe(false);
		});
	});

	describe('Steel Will', () => {
		it('succeeds on a failed save from its own pool', () => {
			expect(ruleOfType(STEEL_WILL, 'changeResult')).toMatchObject({
				change: 'succeed',
				rolls: ['save'],
				outcome: 'failed',
				chargePoolIdentifier: 'steel-will',
			});
		});
	});

	describe('Knowledge from Beyond', () => {
		const data = ruleOfType(KNOWLEDGE, 'changeResult');

		it('costs 1 Wound and has no pool', () => {
			expect(data).toMatchObject({
				change: 'succeed',
				outcome: 'failed',
				woundCost: 1,
				chargePoolIdentifier: '',
			});
		});

		it('covers a failed Insight or Arcana check only', () => {
			const rule = liveRule(ChangeResultRule, data);
			expect(offersOnRoll(rule, SKILL('insight'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, SKILL('arcana'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, SKILL('lore'), card(5, 'failed'))).toBe(false);
			expect(offersOnRoll(rule, SAVE('intelligence'), card(5, 'failed'))).toBe(false);
		});
	});

	describe('Epic Resistance', () => {
		it('spends one pool, which refills each encounter, for a save and for damage', () => {
			const save = ruleOfType(EPIC_RESISTANCE, 'changeResult', 'succeed');
			const damage = ruleOfType(EPIC_RESISTANCE, 'changeResult', 'noDamage');
			expect(rulesOfType(EPIC_RESISTANCE, 'chargePool')).toHaveLength(1);
			expect(save.chargePoolIdentifier).toBe('epic-resistance');
			expect(damage.chargePoolIdentifier).toBe('epic-resistance');
			expect(ruleOfType(EPIC_RESISTANCE, 'chargePool')).toMatchObject({
				identifier: 'epic-resistance',
				max: '1',
				recoveries: expect.arrayContaining([
					expect.objectContaining({ trigger: 'encounterStart' }),
				]),
			});
		});

		it('offers no damage to the target of an attack, not to the one who rolled', () => {
			const rule = liveRule(
				ChangeResultRule,
				ruleOfType(EPIC_RESISTANCE, 'changeResult', 'noDamage'),
			);
			expect(rule.offersUseOn({ side: 'target', roll: ATTACK() })).toBe(true);
			expect(rule.offersUseOn({ side: 'roller', roll: ATTACK() })).toBe(false);
			expect(rule.attackTrigger).toBe('hit');
		});
	});

	describe("I'm So Famous!", () => {
		const data = ruleOfType(FAMOUS, 'modifyReroll');

		it('says the Inspiration reroll cannot fail', () => {
			expect(data.cannotFail).toBe(true);
			expect(data.rollModeChange).toBe(0);
		});

		it('names the identifier of the Inspiration reroll, as the other Songweaver items do', () => {
			const inspiration = ruleOfType(INSPIRATION, 'reroll');
			expect(inspiration.identifier).toBe('songweavers-inspiration');
			expect(data.rerollIdentifier).toBe(inspiration.identifier);
			const courage = ruleOfType(
				`${FEATURES}/songweaver/songweaver-subclasses/herald-of-courage/unfailing-courage.json`,
				'modifyReroll',
			);
			expect(data.rerollIdentifier).toBe(courage.rerollIdentifier);
		});
	});

	describe('Mighty Soul', () => {
		const data = ruleOfType(MIGHTY_SOUL, 'changeResult');

		it('adds STR to a failed save for 1 Wound, with no limit on the uses', () => {
			expect(data).toMatchObject({
				change: 'add',
				formula: '@strength',
				rolls: ['save'],
				outcome: 'failed',
				woundCost: 1,
				chargePoolIdentifier: '',
			});
			const rule = liveRule(ChangeResultRule, data);
			expect(rule.resultUseFor(roller)).toEqual({ change: 'add', value: 3, stat: 'strength' });
			expect(offersOnRoll(rule, SAVE('will'), card(20, 'succeeded'))).toBe(false);
		});
	});

	describe('Cheat!', () => {
		const rules = rulesOfType(CHEAT, 'changeResult');
		const skill = rules.find((rule) => (rule.rolls as string[]).includes('skillCheck'));
		const initiative = rules.find((rule) => (rule.rolls as string[]).includes('initiative'));
		if (!skill || !initiative) throw new Error('Cheat! has lost a rule');

		it('keeps its rules for the free Move or Hide and for games', () => {
			expect(ruleOfType(CHEAT, 'situationalRollMode').id).toBe('IcKe27NHzAsdT0T0');
			expect(ruleOfType(CHEAT, 'chargeConsumer').poolIdentifier).toBe('cheat-free-move-or-hide');
			expect(ruleOfType(CHEAT, 'actionDelta').id).toBe('zEpqjsJl49AcfRyH');
		});

		it('changes any skill check to 10+INT, from a pool that refills on a Safe Rest', () => {
			expect(skill).toMatchObject({
				change: 'setTotal',
				formula: '10+@intelligence',
				outcome: 'always',
				onlyIfLower: false,
				chargePoolIdentifier: 'cheat-skill-check',
			});
			const pool = rulesOfType(CHEAT, 'chargePool').find(
				(candidate) => candidate.identifier === 'cheat-skill-check',
			);
			expect(pool).toMatchObject({
				max: '1',
				recoveries: [expect.objectContaining({ trigger: 'safeRest' })],
			});
			const rule = liveRule(ChangeResultRule, skill);
			expect(rule.resultUseFor(roller)).toMatchObject({ change: 'setTotal', value: 12 });
			expect(offersOnRoll(rule, SKILL('stealth'), card(18, 'succeeded'))).toBe(true);
			expect(offersOnRoll(rule, SAVE('will'), card(5, 'failed'))).toBe(false);
		});

		it('changes Initiative under 10 to 10, at no cost', () => {
			expect(initiative).toMatchObject({
				change: 'setTotal',
				formula: '10',
				onlyIfLower: true,
				chargePoolIdentifier: '',
				woundCost: 0,
			});
			const rule = liveRule(ChangeResultRule, initiative);
			expect(offersOnRoll(rule, INITIATIVE, card(9))).toBe(true);
			expect(offersOnRoll(rule, INITIATIVE, card(10))).toBe(false);
			expect(offersOnRoll(rule, SKILL('stealth'), card(9))).toBe(false);
		});
	});

	describe('Bumblewise', () => {
		const rule = liveRule(ChangeResultRule, ruleOfType(BUMBLEWISE, 'changeResult'));

		it('covers a WIL save and each WIL skill the book names', () => {
			expect(rule.countsAsNat20On(SAVE('will'))).toBe(true);
			for (const skill of ['naturecraft', 'perception', 'influence', 'insight']) {
				expect(rule.countsAsNat20On(SKILL(skill))).toBe(true);
			}
		});

		it('covers no roll of another stat', () => {
			expect(rule.countsAsNat20On(SAVE('strength'))).toBe(false);
			expect(rule.countsAsNat20On(SKILL('might'))).toBe(false);
			expect(rule.countsAsNat20On(ATTACK('will'))).toBe(false);
		});
	});

	describe('Wily Underdog', () => {
		const data = ruleOfType(WILY, 'reroll');
		const rule = liveRule(RerollRule, data);

		it('rerolls a failed roll with another stat, from a pool that refills on a Safe Rest', () => {
			expect(data).toMatchObject({
				outcome: 'failed',
				useAnotherStat: true,
				chargePoolIdentifier: 'wily-underdog',
			});
			expect(rule.usesAnotherStat).toBe(true);
			expect(ruleOfType(WILY, 'chargePool').recoveries).toEqual([
				expect.objectContaining({ trigger: 'safeRest' }),
			]);
		});

		it('covers a STR attack, a STR save and a STR skill, and no other stat', () => {
			expect(offersOnRoll(rule, ATTACK('strength'))).toBe(true);
			expect(offersOnRoll(rule, SAVE('strength'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, SKILL('might'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, ATTACK('dexterity'))).toBe(false);
			expect(offersOnRoll(rule, SAVE('will'), card(5, 'failed'))).toBe(false);
			expect(offersOnRoll(rule, SAVE('strength'), card(20, 'succeeded'))).toBe(false);
		});
	});

	describe('Accidental Acrobat', () => {
		const data = ruleOfType(ACROBAT, 'reroll');
		const rule = liveRule(RerollRule, data);

		it('rerolls a failed DEX roll at no cost', () => {
			expect(data).toMatchObject({
				outcome: 'failed',
				chargePoolIdentifier: '',
				useAnotherStat: false,
			});
			expect(offersOnRoll(rule, ATTACK('dexterity'))).toBe(true);
			expect(offersOnRoll(rule, SAVE('dexterity'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, SKILL('stealth'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, SKILL('finesse'), card(5, 'failed'))).toBe(true);
			expect(offersOnRoll(rule, SKILL('might'), card(5, 'failed'))).toBe(false);
		});

		it('tells on the card that the GM decides the consequences', () => {
			expect(rule.cardHintFor({ side: 'roller', roll: SAVE('dexterity') })).toBe(
				'If you still fail, the consequences are BAD. The GM decides them.',
			);
		});
	});

	describe("So Dumb I'm Smart Sometimes", () => {
		const rules = rulesOfType(SO_DUMB, 'reroll');
		const save = rules.find((rule) => (rule.rolls as string[]).includes('save'));
		const skill = rules.find((rule) => (rule.rolls as string[]).includes('skillCheck'));

		it('rerolls a failed INT save with advantage', () => {
			expect(save).toMatchObject({
				saves: ['intelligence'],
				outcome: 'failed',
				rollModeChange: 1,
				chargePoolIdentifier: 'so-dumb-im-smart-sometimes-save',
			});
		});

		it('rerolls an INT skill check that did not need to fail', () => {
			expect(skill).toMatchObject({
				skills: ['arcana', 'examination', 'lore'],
				outcome: 'always',
				rollModeChange: 0,
				chargePoolIdentifier: 'so-dumb-im-smart-sometimes-skill',
			});
		});
	});

	describe('Cunning Strike', () => {
		it('has the DC of the book, 10+INT', () => {
			const [node] = readItem(CUNNING_STRIKE).system.activation.effects;
			expect(node).toMatchObject({ type: 'savingThrow', saveDC: '10+@intelligence' });
		});
	});

	describe.each(FILES)('%s', (file) => {
		const rules = packRules(file);

		it('gives each rule an id of its own', () => {
			const ids = rules.map((rule) => rule.id);
			expect(new Set(ids).size).toBe(ids.length);
			for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
		});

		it('names only a pool the item has', () => {
			const pools = rules
				.filter((rule) => rule.type === 'chargePool')
				.map((rule) => rule.identifier);
			for (const rule of rules) {
				const identifier = rule.chargePoolIdentifier;
				if (identifier) expect(pools).toContain(identifier);
			}
		});
	});

	it('uses only fields and choices the rule code has', () => {
		const schemas = {
			changeResult: ChangeResultRule,
			reroll: RerollRule,
			modifyReroll: ModifyRerollRule,
		};
		for (const file of FILES) {
			for (const rule of packRules(file)) {
				const RuleClass = schemas[rule.type as keyof typeof schemas];
				if (!RuleClass) continue;
				const schema = RuleClass.defineSchema() as unknown as Record<string, FieldLike>;
				for (const [name, value] of Object.entries(rule)) {
					expect(schema, `${file} ${rule.type}.${name}`).toHaveProperty(name);
					const field = schema[name];
					const values = Array.isArray(value) ? value : [value];
					const choices = Array.isArray(value) ? field?.element?.choices : field?.choices;
					if (!choices || typeof choices === 'function') continue;
					const allowed = Array.isArray(choices) ? choices : Object.keys(choices);
					for (const entry of values) {
						if (typeof entry === 'string') {
							expect(allowed, `${file} ${rule.type}.${name}`).toContain(entry);
						}
					}
				}
			}
		}
	});
});
