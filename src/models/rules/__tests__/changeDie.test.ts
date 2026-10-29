import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ChangeDieRule } from '../changeDie.js';

type FieldLike = {
	initial?: unknown;
	label?: string;
	hint?: string;
	choices?: Record<string, string>;
	options?: { label?: string; showWhen?: (data: Record<string, unknown>) => boolean };
};

const schema = ChangeDieRule.defineSchema() as unknown as Record<string, FieldLike>;

function makeRule(config: Record<string, unknown> = {}) {
	const actor = {
		uuid: 'Actor.cheat',
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
	};
	const item = {
		isEmbedded: true,
		actor,
		name: 'Vicious Opportunist',
		uuid: 'Actor.cheat.Item.vo',
		getDomain: () => new Set<string>(),
	};
	const rule = new ChangeDieRule({ type: 'changeDie' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		rolls: ['attack'],
		saves: [],
		skills: [],
		abilities: [],
		usedBy: 'roller',
		outcome: 'hit',
		attackDelivery: 'melee',
		otherCreature: new Predicate({}),
		predicate: new Predicate({}),
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		actionCost: 0,
		die: 'primaryDie',
		change: 'set',
		amount: 1,
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

describe('ChangeDieRule', () => {
	it('defines its own fields with their defaults', () => {
		expect(schema.die?.initial).toBe('primaryDie');
		expect(schema.change?.initial).toBe('set');
		expect(schema.amount?.initial).toBe(1);
		expect(schema.type?.initial).toBe('changeDie');
		expect(Object.keys(schema.die?.choices ?? {})).toEqual(['primaryDie', 'pickedDie']);
		expect(Object.keys(schema.change?.choices ?? {})).toEqual(['set', 'add']);
	});

	it('has the shared roll use fields but no reroll-only fields', () => {
		for (const name of [
			'rolls',
			'usedBy',
			'outcome',
			'otherCreature',
			'actionCost',
			'oncePerAttack',
		]) {
			expect(schema[name], name).toBeTruthy();
		}
		for (const name of [
			'automatic',
			'keep',
			'discardedCritTriggers',
			'rollModeChange',
			'extraDamage',
		]) {
			expect(schema[name], name).toBeUndefined();
		}
	});

	it('uses its own words where the Reroll words say reroll', () => {
		const label = (name: string) => (schema[name]?.options ?? schema[name])?.label;
		expect(label('rolls')).toBe('NIMBLE.rules.changeDie.rolls.label');
		expect(label('oncePerAttack')).toBe('NIMBLE.rules.changeDie.oncePerAttack.label');
		expect(label('usedBy')).toBe('NIMBLE.rules.reroll.usedBy.label');
	});

	it('asks for the number only to add one', () => {
		const showWhen = schema.amount?.options?.showWhen;
		expect(showWhen?.({ change: 'add' })).toBe(true);
		expect(showWhen?.({ change: 'set' })).toBe(false);
	});

	it('says what one use changes', () => {
		expect(makeRule().dieChange).toEqual({ mode: 'set', amount: 0 });
		expect(makeRule({ change: 'add', amount: -2 }).dieChange).toEqual({ mode: 'add', amount: -2 });
		expect(makeRule({ change: 'add', amount: 0 }).dieChange).toEqual({ mode: 'add', amount: 1 });
	});

	it('offers on the rolls and side it names, through the shared part', () => {
		const rule = makeRule();
		expect(
			rule.offersRerollOn({ side: 'roller', roll: { kind: 'attack', delivery: 'melee' } }),
		).toBe(true);
		expect(
			rule.offersRerollOn({ side: 'roller', roll: { kind: 'attack', delivery: 'ranged' } }),
		).toBe(false);
		expect(
			rule.offersRerollOn({ side: 'target', roll: { kind: 'attack', delivery: 'melee' } }),
		).toBe(false);
	});

	it('is a choice, never automatic', () => {
		expect(
			(makeRule() as unknown as { rerollsByItself?: boolean }).rerollsByItself,
		).toBeUndefined();
	});
});
