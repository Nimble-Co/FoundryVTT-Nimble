import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ActionCostRule } from '../actionCost.js';
import { RerollRule } from '../reroll.js';
import { SpellManaCostRule } from '../spellManaCost.js';
import { UseOptionRule } from '../useOption.js';

type Json = Record<string, any>;

const MAGE = 'packs/classFeatures/core/mage';
const SPELL_SHAPER = `${MAGE}/mage-progression/spell-shaper.json`;
const ARCHMAGE = `${MAGE}/mage-progression/archmage.json`;
const SPELLSHAPER = `${MAGE}/spellshaper`;
const ability = (slug: string) => `${SPELLSHAPER}/${slug}.json`;

const POOL = 'spellshaper';

const readItem = (file: string): Json => JSON.parse(readFileSync(resolve(file), 'utf8'));

const actor = {
	uuid: 'Actor.mage',
	system: { resources: { mana: { current: 5, max: 12 } } },
	getDomain: () => new Set<string>(),
	getFlag: () => undefined,
	getRollData: () => ({ resources: { mana: { current: 5, max: 12 } }, will: 3 }),
	items: [],
	rules: [],
};

function liveRule<T>(RuleClass: new (...args: never[]) => T, data: Json, name: string): T {
	const parent = {
		isEmbedded: true,
		actor,
		name,
		uuid: `Actor.mage.Item.${name}`,
		getDomain: () => new Set<string>(),
	};
	const rule = new RuleClass({ type: data.type } as never, { parent, strict: false } as never);
	Object.assign(rule as object, { ...data, predicate: new Predicate({}) });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

/** The one Spell or Attack Option rule of a Spellshaper ability, live. */
function optionOf(slug: string): UseOptionRule {
	const item = readItem(ability(slug));
	const rules = (item.system.rules as Json[]).filter((rule) => rule.type === 'useOption');
	expect(rules).toHaveLength(1);
	return liveRule(UseOptionRule, rules[0], item.name);
}

function spell({ tier = 1, targets = 1, template = false } = {}) {
	return {
		type: 'spell',
		system: {
			identifier: 'fire-bolt',
			tier,
			school: 'fire',
			activation: { acquireTargetsFromTemplate: template, targets: { count: targets } },
		},
	};
}

const CANTRIP = spell({ tier: 0 });
const TIERED = spell({ tier: 2 });
const AREA = spell({ tier: 2, template: true });

describe('Spell Shaper pack item', () => {
	const pools = (readItem(SPELL_SHAPER).system.rules as Json[]).filter(
		(rule) => rule.type === 'chargePool',
	);

	it('has one actor pool "Spellshaper (1/turn)" with 1 use', () => {
		expect(pools).toEqual([
			expect.objectContaining({
				identifier: POOL,
				label: 'Spellshaper (1/turn)',
				scope: 'actor',
				max: '1',
				initial: 'max',
				disabled: false,
			}),
		]);
	});

	it('refills at the start of each creature turn and at the end of the encounter', () => {
		expect(pools[0].recoveries).toEqual([
			expect.objectContaining({ trigger: 'onAnyTurnStart', mode: 'refresh' }),
			expect.objectContaining({ trigger: 'encounterEnd', mode: 'refresh' }),
		]);
	});
});

describe('Spellshaper abilities', () => {
	const OPTIONS = [
		'dimensional-compression',
		'extra-dimensional-vision',
		'echo-casting',
		'precise-casting',
		'elemental-transmutation',
		'stretch-time',
		'methodical-spellweaver',
	];

	it.each(OPTIONS)(
		'%s is a spell option on the Spellshaper pool, with nothing by default',
		(slug) => {
			const option = optionOf(slug);
			expect(option.target).toBe('spell');
			expect(option.poolIdentifier).toBe(POOL);
			expect(option.kind).toBe('mana');
			expect(option.beyond).toBe('notAllowed');
			expect(option.replacesSpellCost).toBe(false);
			expect(option.label).toBe(readItem(ability(slug)).name);
		},
	);

	it('Dimensional Compression spends 1 mana or more, +4 range for each', () => {
		const option = optionOf('dimensional-compression');
		expect(option.resourceCost.spend).toEqual({ mode: 'variable', min: '1', max: '12' });
		expect(option.rangePerMana).toBe(4);
		expect(option.appliesToSpell(CANTRIP)).toBe(true);
		expect(option.appliesToSpell(AREA)).toBe(true);
	});

	it('Extra-Dimensional Vision spends 2 mana and puts a line of sight note on the card', () => {
		const option = optionOf('extra-dimensional-vision');
		expect(option.resourceCost).toMatchObject({ amount: 2, spend: { mode: 'fixed' } });
		expect(option.cardNote).toBe('The spell ignores line of sight.');
		expect(option.appliesToSpell(CANTRIP)).toBe(true);
	});

	it('Echo Casting costs twice the cast mana, min 1, for a tiered single-target spell', () => {
		const option = optionOf('echo-casting');
		expect(option.resourceCost).toMatchObject({
			amount: 'max(1, 2 * @castManaSpent)',
			spend: { mode: 'fixed' },
		});
		expect(option.freeCopy).toBe(true);
		expect(option.appliesToSpell(TIERED)).toBe(true);
		expect(option.appliesToSpell(CANTRIP)).toBe(false);
		expect(option.appliesToSpell(AREA)).toBe(false);
		expect(option.appliesToSpell(spell({ tier: 2, targets: 2 }))).toBe(false);
	});

	it('Precise Casting spends 1 mana or more and says how many creatures are unaffected', () => {
		const option = optionOf('precise-casting');
		expect(option.resourceCost.spend).toEqual({ mode: 'variable', min: '1', max: '12' });
		expect(option.cardNote).toBe('{amount} creatures unaffected');
		expect(option.appliesToSpell(AREA)).toBe(true);
	});

	it('Elemental Transmutation spends 1 mana for a pick of Fire, Ice, Lightning, Necrotic or Radiant', () => {
		const option = optionOf('elemental-transmutation');
		expect(option.resourceCost).toMatchObject({ amount: 1, spend: { mode: 'fixed' } });
		expect(option.damageTypes).toEqual(['fire', 'cold', 'lightning', 'necrotic', 'radiant']);
		expect(option.appliesToSpell(CANTRIP)).toBe(true);
	});

	it('Stretch Time spends 2 mana for 1 action less, min 1', () => {
		const option = optionOf('stretch-time');
		expect(option.resourceCost).toMatchObject({ amount: 2, spend: { mode: 'fixed' } });
		expect(option.actionCostChange).toEqual({ delta: -1, minimum: 1 });
		expect(option.manaCostChange).toBeNull();
		expect(option.appliesToSpell(CANTRIP)).toBe(true);
	});

	it('Methodical Spellweaver spends no mana, 1 action more and 2 mana less, min 1', () => {
		const option = optionOf('methodical-spellweaver');
		expect(option.resourceCost).toMatchObject({ amount: 0, spend: { mode: 'fixed' } });
		expect(option.actionCostChange).toEqual({ delta: 1, minimum: 0 });
		expect(option.manaCostChange).toEqual({ delta: -2, minimum: 1 });
		expect(option.appliesToSpell(TIERED)).toBe(true);
		expect(option.appliesToSpell(CANTRIP)).toBe(false);
	});

	it('Elemental Destruction keeps its reroll and spends the Spellshaper use', () => {
		const item = readItem(ability('elemental-destruction'));
		const [data] = item.system.rules as Json[];
		const rule = liveRule(RerollRule, data, item.name);
		expect(item.system.rules).toHaveLength(1);
		expect(rule.rollUseCost).toMatchObject({
			chargePoolIdentifier: POOL,
			chargeCost: 1,
			manaCost: 1,
			perDie: true,
		});
		expect(rule.maxDice).toBe('@will');
	});
});

describe('Archmage pack item', () => {
	const item = readItem(ARCHMAGE);
	const identifier = item.system.identifier || item.name.slugify({ strict: true });
	const [step] = item.system.activation.effects as Json[];
	const effect = (item.effects as Json[]).find((each) => each._id === step?.effectId) as Json;

	it('uses itself for free when its owner rolls Initiative', () => {
		expect(item.system.rules).toEqual([
			expect.objectContaining({
				type: 'useItemFree',
				itemIdentifier: identifier,
				triggers: ['onInitiative'],
				disabled: false,
			}),
		]);
	});

	it('puts its effect on the user, not on the owner by itself', () => {
		expect(item.system.activation.effects).toEqual([
			expect.objectContaining({ type: 'applyEffect', recipient: 'self' }),
		]);
		expect(effect).toMatchObject({ name: 'Archmage', transfer: false, disabled: false });
	});

	it('makes the next tiered spell cost 5 mana less and 1 action less', () => {
		const rules = effect.system.rules as Json[];
		expect(rules.map((rule) => rule.type).sort()).toEqual(['actionCost', 'spellManaCost']);
		const mana = liveRule(
			SpellManaCostRule,
			rules.find((r) => r.type === 'spellManaCost')!,
			'Archmage',
		);
		const action = liveRule(
			ActionCostRule,
			rules.find((r) => r.type === 'actionCost')!,
			'Archmage',
		);
		expect(mana.resolveValue()).toBe(-5);
		expect(mana.matchesSpell(TIERED)).toBe(true);
		expect(mana.matchesSpell(CANTRIP)).toBe(false);
		expect(action.mode).toBe('delta');
		expect(action.resolveValue()).toBe(-1);
		expect(action.matchesItem(TIERED)).toBe(true);
		expect(action.matchesItem(CANTRIP)).toBe(false);
		expect(action.matchesItem({ type: 'feature', system: {} })).toBe(false);
	});

	it('lasts until the holder casts a tiered spell or combat ends', () => {
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'nextSpell', who: 'holder' }),
			expect.objectContaining({ kind: 'event', event: 'combatEnd' }),
		]);
	});
});

describe('Mage pack text', () => {
	it.each(globSync(`${MAGE}/**/*.json`))('%s has no em-dash or middle dot', (file) => {
		const text = readFileSync(resolve(file), 'utf8');
		expect(text).not.toMatch(/[—·]/);
	});
});
