import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ChangeDieRule } from '../changeDie.js';

type FieldLike = {
	initial?: unknown;
	label?: string;
	hint?: string;
	choices?: Record<string, string>;
	options?: {
		label?: string;
		showWhen?: (data: Record<string, unknown>) => boolean;
		validate?: (value: unknown) => boolean;
	};
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

	it('refuses 0 as the number to add', () => {
		const validate = schema.amount?.options?.validate;
		expect([validate?.(0), validate?.(1), validate?.(-2)]).toEqual([false, true, true]);
	});

	it('says what one use changes', () => {
		expect(makeRule().dieChange).toEqual({ mode: 'set', value: 0 });
		expect(makeRule({ change: 'add', amount: -2 }).dieChange).toEqual({ mode: 'add', value: -2 });
		expect(makeRule({ change: 'add', amount: 0 }).dieChange).toEqual({ mode: 'add', value: 1 });
	});

	it('offers on the rolls and side it names, through the shared part', () => {
		const rule = makeRule();
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'attack', delivery: 'melee' } })).toBe(
			true,
		);
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'attack', delivery: 'ranged' } })).toBe(
			false,
		);
		expect(rule.offersUseOn({ side: 'target', roll: { kind: 'attack', delivery: 'melee' } })).toBe(
			false,
		);
	});

	describe('does not offer', () => {
		const MELEE = { side: 'roller', roll: { kind: 'attack', delivery: 'melee' } } as const;

		it('while it is disabled', () => {
			expect(makeRule({ disabled: true }).offersUseOn(MELEE)).toBe(false);
		});

		it('from an item that is not on an actor', () => {
			const rule = makeRule();
			(rule.item as unknown as { isEmbedded: boolean }).isEmbedded = false;
			expect(rule.offersUseOn(MELEE)).toBe(false);
		});

		it('while its predicate fails', () => {
			const rule = makeRule({ predicate: new Predicate({ self: 'raging' } as never) });
			expect(rule.offersUseOn(MELEE)).toBe(false);
		});
	});
});
