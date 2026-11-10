import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import { Predicate } from '../../../etc/Predicate.js';
import { NimbleBaseRule } from '../base.js';
import { DamageBonusRule } from '../damageBonus.js';
import { SavingThrowBonusRule } from '../savingThrowBonus.js';

class TestRule extends NimbleBaseRule {}

/** The test DataModel keeps no parent, so the parent is stubbed as other rule tests do. */
function withParent<T extends object>(rule: T, parent: object): T {
	Object.defineProperty(rule, 'parent', { value: parent, configurable: true });
	return rule;
}

function ruleOn(parent: object) {
	return withParent(new TestRule({} as never), parent);
}

function makeActor(name = 'Holder') {
	const actor = Object.create(Actor.prototype) as Record<string, unknown>;
	Object.assign(actor, { name, getDomain: () => new Set(['self:holder']) });
	return actor;
}

function makeItem(actor: object | null, uuid = 'Actor.h.Item.i') {
	const item = Object.create(Item.prototype) as Record<string, unknown>;
	Object.assign(item, {
		uuid,
		name: 'Sword',
		actor,
		isEmbedded: !!actor,
		getDomain: () => new Set(['type:weapon']),
	});
	return item;
}

function makeEffect(fields: Record<string, unknown>) {
	return { documentName: 'ActiveEffect', uuid: 'Actor.h.ActiveEffect.e', name: 'Bless', ...fields };
}

let fromUuidSync: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fromUuidSync = vi.fn(() => null);
	vi.stubGlobal('fromUuidSync', fromUuidSync);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('a rule on an Active Effect', () => {
	it('changes the actor the effect is on, and names the effect as its parent', () => {
		const holder = makeActor();
		const effect = makeEffect({ parent: holder, target: holder });

		const rule = ruleOn(effect);

		expect(rule.parentDocument).toBe(effect);
		expect(rule.actor).toBe(holder);
		expect(rule.isOnActor).toBe(true);
	});

	it('takes its item from the origin, which can be on another actor', () => {
		const holder = makeActor();
		const caster = makeActor('Caster');
		const spell = makeItem(caster, 'Actor.c.Item.s');
		fromUuidSync.mockImplementation((uuid: string) => (uuid === spell.uuid ? spell : null));

		const rule = ruleOn(makeEffect({ parent: holder, target: holder, origin: spell.uuid }));

		expect(rule.item).toBe(spell);
		expect(rule.actor).toBe(holder);
	});

	it('reads the origin without throwing when it is inside a compendium', () => {
		const holder = makeActor();
		const origin = 'Compendium.nimble.monsters.Actor.m.Item.claw';

		expect(ruleOn(makeEffect({ parent: holder, target: holder, origin })).item).toBeNull();
		expect(fromUuidSync).toHaveBeenCalledWith(origin, { strict: false });
	});

	it('has no item when the origin is not an item', () => {
		const holder = makeActor();
		fromUuidSync.mockReturnValue(holder);

		const rule = ruleOn(makeEffect({ parent: holder, target: holder, origin: 'Actor.c' }));

		expect(rule.item).toBeNull();
	});

	it('takes its item from the item that transfers the effect', () => {
		const holder = makeActor();
		const sword = makeItem(holder);

		const rule = ruleOn(makeEffect({ parent: sword, target: holder, origin: null }));

		expect(rule.item).toBe(sword);
		expect(rule.actor).toBe(holder);
	});

	it('is not on an actor while the effect waits on an item to be applied', () => {
		const sword = makeItem(makeActor());

		const rule = ruleOn(makeEffect({ parent: sword, target: sword }));

		expect(rule.isOnActor).toBe(false);
		expect(rule.actor).toBeNull();
	});

	it('tests its predicate against the actor tags only, with no item tags', () => {
		const holder = makeActor();
		const onEffect = ruleOn(makeEffect({ parent: holder, target: holder }));
		const onItem = ruleOn(makeItem(holder));
		for (const rule of [onEffect, onItem]) {
			Object.assign(rule, { disabled: false, predicate: new Predicate({ type: 'weapon' }) });
		}

		expect(onEffect.appliesTo()).toBe(false);
		expect(onItem.appliesTo()).toBe(true);
	});
});

describe('a rule on an item', () => {
	it('is its own item, on the item actor, with the item tags', () => {
		const holder = makeActor();
		const sword = makeItem(holder);

		const rule = ruleOn(sword);

		expect(rule.parentDocument).toBe(sword);
		expect(rule.item).toBe(sword);
		expect(rule.actor).toBe(holder);
		expect(rule.isOnActor).toBe(true);
		expect([...rule.parentDomain]).toEqual(['type:weapon']);
	});

	it('is not on an actor when the item is not embedded', () => {
		expect(ruleOn(makeItem(null)).isOnActor).toBe(false);
	});
});

describe('bonus rules on an Active Effect', () => {
	function holderWithSaves(name: string) {
		const actor = makeActor(name);
		Object.assign(actor, {
			system: { savingThrows: { strength: { bonus: 0 } } },
			getRollData: () => ({}),
		});
		return actor as Record<string, unknown> & {
			system: { savingThrows: { strength: { bonus: number } }; damageBonuses?: unknown[] };
		};
	}

	function withFields<T extends object>(
		rule: T,
		parent: object,
		fields: Record<string, unknown>,
	): T {
		Object.assign(rule, { disabled: false, predicate: { size: 0 }, ...fields });
		return withParent(rule, parent);
	}

	it('a saving throw bonus raises the save of the creature with the effect, not the caster', () => {
		const holder = holderWithSaves('Holder');
		const caster = holderWithSaves('Caster');
		fromUuidSync.mockReturnValue(makeItem(caster, 'Actor.c.Item.s'));
		const effect = makeEffect({ parent: holder, target: holder, origin: 'Actor.c.Item.s' });
		const rule = withFields(new SavingThrowBonusRule({} as never), effect, {
			value: '2',
			savingThrows: ['strength'],
		});

		rule.prePrepareData();

		expect(holder.system.savingThrows.strength.bonus).toBe(2);
		expect(caster.system.savingThrows.strength.bonus).toBe(0);
	});

	it('a damage bonus is added to the damage bonuses of the creature with the effect', () => {
		const holder = holderWithSaves('Holder');
		const effect = makeEffect({ parent: holder, target: holder });
		const rule = withFields(new DamageBonusRule({} as never), effect, {
			value: '3',
			damageType: '',
			delivery: 'any',
			source: 'any',
			itemIdentifier: '',
		});

		rule.afterPrepareData();

		expect(holder.system.damageBonuses).toEqual([
			expect.objectContaining({ value: 3, formula: null }),
		]);
	});

	it('a bonus on an effect waiting on an item changes nothing', () => {
		const owner = holderWithSaves('Owner');
		const sword = makeItem(owner);
		const rule = withFields(
			new SavingThrowBonusRule({} as never),
			makeEffect({ parent: sword, target: sword }),
			{ value: '2', savingThrows: ['strength'] },
		);

		rule.prePrepareData();

		expect(owner.system.savingThrows.strength.bonus).toBe(0);
	});
});

describe('rule types that need an item', () => {
	it('are the types that act on their own item, or that only an item list reads', () => {
		const itemOnly = Object.entries(RULE_CLASSES)
			.filter(([, Cls]) => (Cls as typeof NimbleBaseRule).worksOnEffects === false)
			.map(([type]) => type)
			.sort();

		expect(itemOnly).toEqual(
			[
				'actionDelta',
				'chargeConsumer',
				'chargePool',
				'combatMana',
				'critBack',
				'damageMultiplier',
				'diceConsumer',
				'dicePool',
				'dieResultEffect',
				'freeAssess',
				'grantActivation',
				'grantItem',
				'grantSpells',
				'hitCondition',
				'holdOnTarget',
				'initiativeMessage',
				'markTarget',
				'modifyConsumer',
				'modifyPool',
				'modifyReroll',
				'modifyToggle',
				'optionSwap',
				'poolEmptyEffect',
				'savingThrowRollMode',
				'skillPointMove',
				'toggleEffect',
			].sort(),
		);
	});
});

describe('rule types that need an effect', () => {
	it('are the types that only an effect on a creature reads', () => {
		const effectOnly = Object.entries(RULE_CLASSES)
			.filter(([, Cls]) => (Cls as typeof NimbleBaseRule).worksOnItems === false)
			.map(([type]) => type)
			.sort();

		expect(effectOnly).toEqual(['heldRoll']);
	});
});
