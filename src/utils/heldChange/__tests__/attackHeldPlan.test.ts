import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeldChange } from '#types/heldChange.d.ts';
import {
	type HeldRollEffectSpec,
	heldRollEffect,
} from '../../../../tests/fixtures/heldRollEffect.js';
import { attackHeldPlanOf } from '../attackHeldPlan.js';

type HeldSpec = HeldRollEffectSpec;

const documents = new Map<string, unknown>();

function creature(uuid: string, held: HeldSpec[] = []) {
	const holder = {
		uuid,
		isOwner: true,
		effects: held.map((spec, index) => heldRollEffect(`${uuid}-e${index}`, spec)),
		createEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
	documents.set(uuid, holder);
	return holder;
}

const ignore: HeldSpec = {
	kind: 'ignoreDisadvantage',
	value: 0,
	label: 'Demand Control',
	whichRoll: 'holderAttacks',
};
const mustAttack: HeldSpec = {
	kind: 'mustAttackOther',
	value: 0,
	label: 'Taunt',
	whichRoll: 'holderAttacks',
};
const kept: HeldSpec = { kind: 'wholeAmount', value: 7, label: 'Kept', whichRoll: 'holderAttacks' };
const advantage = (value = 1): HeldSpec => ({ kind: 'advantage', value, label: 'Advantage' });
const maximize: HeldSpec = { kind: 'maximize', value: 0, label: 'Maximize' };

function keptChangeOf(holder: ReturnType<typeof creature>, effectId: string): HeldChange {
	return {
		kind: 'wholeAmount',
		value: 7,
		label: 'Kept',
		sourceName: 'Kept',
		appliesTo: 'holderAttacks',
		spentBy: 'oneRoll',
		meleeOnly: false,
		onlyFromUuid: null,
		effectId,
		ruleId: 'r1',
		holderUuid: holder.uuid,
	};
}

const globals = globalThis as unknown as Record<string, any>;
let saved: Record<string, unknown>;

beforeEach(() => {
	saved = { fromUuidSync: globals.fromUuidSync };
	documents.clear();
	globals.fromUuidSync = vi.fn((uuid: string) => documents.get(uuid) ?? null);
});

afterEach(() => {
	globals.fromUuidSync = saved.fromUuidSync;
});

function spentIds(...holders: ReturnType<typeof creature>[]) {
	return holders.flatMap((holder) =>
		holder.deleteEmbeddedDocuments.mock.calls.flatMap(
			(call) => (call as unknown as [string, string[]])[1],
		),
	);
}

describe('attackHeldPlanOf', () => {
	it('adds the Primary Die changes and spends each change the attack used', async () => {
		const attacker = creature('A', [ignore, mustAttack]);
		const target = creature('T', [{ value: 2 }, { label: 'Anticipate Danger', value: -1 }]);

		const plan = attackHeldPlanOf({ attacker, target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: -1, rollModeSources: [-1, 1] };
		plan.applyToRoll(options as never);
		await plan.spend();

		// Ignoring disadvantage also drops the negative change.
		expect(plan.bonusLines()).toEqual([{ label: 'Create an Opening', value: 2, itemUuid: '' }]);
		expect(plan.primaryDieBonus).toBe(2);
		expect(options.rollMode).toBe(0);
		expect(options.rollModeSources).toEqual([1]);
		expect(options.outcomeSources).toEqual({ mustAttackOther: ['Taunt'] });
		expect(spentIds(attacker, target)).toEqual(['A-e0', 'A-e1', 'T-e0']);
	});

	it('uses no Primary Die change and keeps disadvantage when a kept amount replaces the roll', async () => {
		const attacker = creature('A', [ignore, kept]);
		const target = creature('T', [{}]);
		const keptChange = keptChangeOf(attacker, 'A-e1');

		const plan = attackHeldPlanOf({
			attacker,
			target,
			area: false,
			attack: true,
			kept: keptChange,
			keptToEnd: keptChange,
		});
		await plan.spend();

		expect(plan.primaryDie).toEqual([]);
		expect(plan.ignoreDisadvantage).toBeNull();
		expect(spentIds(attacker, target)).toEqual(['A-e1']);
	});

	it('does not spend the ignore change on a roll with no disadvantage to take out', () => {
		const attacker = creature('A', [ignore]);

		const plan = attackHeldPlanOf({
			attacker,
			target: null,
			area: false,
			attack: true,
			noDisadvantageToIgnore: true,
		});

		expect(plan.ignoreDisadvantage).toBeNull();
	});

	it('uses no Primary Die change on a roll that is not an attack, but still reports who to attack', () => {
		const attacker = creature('A', [ignore, mustAttack]);
		const target = creature('T', [{}]);

		const plan = attackHeldPlanOf({ attacker, target, area: false, attack: false });

		expect(plan.primaryDie).toEqual([]);
		expect(plan.ignoreDisadvantage).toBeNull();
		expect(plan.mustAttackOther?.label).toBe('Taunt');
	});

	it('drops the Primary Die changes for a roll with no Primary Die, and spends the rest', async () => {
		const attacker = creature('A', [mustAttack]);
		const target = creature('T', [{}]);

		const plan = attackHeldPlanOf({
			attacker,
			target,
			area: false,
			attack: true,
		}).withoutPrimaryDie();
		await plan.spend();

		expect(plan.bonusLines()).toEqual([]);
		expect(plan.primaryDieBonus).toBe(0);
		expect(spentIds(attacker, target)).toEqual(['A-e0']);
	});
});

describe('attackHeldPlanOf with advantage changes', () => {
	it('appends one roll mode source for each advantage change', () => {
		const target = creature('T', [advantage(1), advantage(2)]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: 0, rollModeSources: [-1] };

		plan.applyToRoll(options as never);

		expect(options.rollModeSources).toEqual([-1, 1, 2]);
	});

	it('appends a minus advantage change as a disadvantage source', () => {
		const target = creature('T', [advantage(-1)]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: 0, rollModeSources: [] };

		plan.applyToRoll(options as never);

		expect(options.rollModeSources).toEqual([-1]);
	});

	it('takes out a minus advantage change and keeps a plus one when it ignores disadvantage', () => {
		const attacker = creature('A', [ignore]);
		const target = creature('T', [advantage(-1), advantage(1)]);
		const plan = attackHeldPlanOf({ attacker, target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: 0, rollModeSources: [] };

		plan.applyToRoll(options as never);

		expect(options.rollModeSources).toEqual([1]);
	});

	it('starts the roll mode sources from the roll mode when it has none', () => {
		const target = creature('T', [advantage(1)]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: -2 };

		plan.applyToRoll(options as never);

		expect(options.rollModeSources).toEqual([-2, 1]);
	});

	it('does not touch the roll mode sources with no advantage change', () => {
		const plan = attackHeldPlanOf({
			attacker: creature('A'),
			target: creature('T'),
			area: false,
			attack: true,
		});
		const options: Record<string, any> = { rollMode: 0 };

		plan.applyToRoll(options as never);

		expect(options.rollModeSources).toBeUndefined();
	});

	it('spends the advantage change', async () => {
		const target = creature('T', [advantage(1)]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });

		await plan.spend();

		expect(spentIds(target)).toEqual(['T-e0']);
	});

	it('uses no advantage change when a kept amount replaces the roll', () => {
		const attacker = creature('A', [kept]);
		const target = creature('T', [advantage(1)]);
		const keptChange = keptChangeOf(attacker, 'A-e0');

		const plan = attackHeldPlanOf({
			attacker,
			target,
			area: false,
			attack: true,
			kept: keptChange,
		});

		expect(plan.advantage).toEqual([]);
	});
});

describe('attackHeldPlanOf with a maximize change', () => {
	it('maximizes the dice as a crit and names the source', () => {
		const target = creature('T', [maximize]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: 0 };

		plan.applyToRoll(options as never);

		expect(options.maxDamage).toBe('crit');
		expect(options.outcomeSources).toEqual({ maxDamage: ['Maximize'] });
	});

	it('maximizes the dice as a hit when the roll cannot crit', () => {
		const target = creature('T', [maximize]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: 0, canCrit: false };

		plan.applyToRoll(options as never);

		expect(options.maxDamage).toBe('hit');
	});

	it('does not change a max damage the roll has already', () => {
		const target = creature('T', [maximize]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: 0, maxDamage: 'hit' };

		plan.applyToRoll(options as never);

		expect(options.maxDamage).toBe('hit');
		expect(options.outcomeSources).toBeUndefined();
	});

	it('spends the maximize change', async () => {
		const target = creature('T', [maximize]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });

		await plan.spend();

		expect(spentIds(target)).toEqual(['T-e0']);
	});

	it('uses no maximize change when a kept amount replaces the roll', () => {
		const attacker = creature('A', [kept]);
		const target = creature('T', [maximize]);
		const keptChange = keptChangeOf(attacker, 'A-e0');

		const plan = attackHeldPlanOf({
			attacker,
			target,
			area: false,
			attack: true,
			kept: keptChange,
		});

		expect(plan.maximize).toBeNull();
	});
});

describe('attackHeldPlanOf extra damage', () => {
	const radiant: HeldSpec = {
		kind: 'extraDamage',
		value: 1,
		label: 'Shining Mandate',
		whichRoll: 'holderAttacks',
		damageType: 'radiant',
		formula: '1d8',
	};

	class FixedRoll {
		formula: string;
		total = 0;
		constructor(
			formula: string,
			readonly data: Record<string, unknown>,
		) {
			this.formula = formula;
		}
		async evaluate() {
			if (this.formula.includes('@')) throw new Error('unresolved');
			this.total = 5;
			return this;
		}
		toJSON() {
			return { formula: this.formula, total: this.total };
		}
	}

	beforeEach(() => {
		vi.stubGlobal('Roll', FixedRoll);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('adds a typed damage part for each extra damage change, and spends each one', async () => {
		const attacker = creature('A', [radiant, { ...radiant, formula: '2', damageType: 'fire' }]);

		const plan = attackHeldPlanOf({
			attacker,
			target: null,
			area: false,
			attack: true,
			extraDamage: true,
		});
		const parts = await plan.rollExtraDamage({ strength: 2 });
		await plan.spend();

		expect(parts.map((part) => [part.node.formula, part.node.damageType])).toEqual([
			['1d8', 'radiant'],
			['2', 'fire'],
		]);
		expect(parts[0].roll.total).toBe(5);
		expect(spentIds(attacker)).toEqual(['A-e0', 'A-e1']);
	});

	it('deals the extra damage only on a hit: its node has a hit outcome and no miss outcome', async () => {
		const plan = attackHeldPlanOf({
			attacker: creature('A', [radiant]),
			target: null,
			area: false,
			attack: true,
			extraDamage: true,
		});

		const [part] = await plan.rollExtraDamage({});

		expect(part.node.parentNode).toBeNull();
		expect(Object.keys(part.node.on ?? {})).toEqual(['hit']);
		expect(part.node.on?.hit?.[0]).toMatchObject({ type: 'damageOutcome', parentContext: 'hit' });
	});

	it('spend() spends the extra damage change with no hit or miss input', async () => {
		const attacker = creature('A', [radiant]);
		const plan = attackHeldPlanOf({
			attacker,
			target: null,
			area: false,
			attack: true,
			extraDamage: true,
		});

		await plan.spend();

		expect(spentIds(attacker)).toEqual(['A-e0']);
	});

	it('is not used by a roll that is not an attack', async () => {
		const attacker = creature('A', [radiant]);
		const notAttack = attackHeldPlanOf({
			attacker,
			target: null,
			area: false,
			attack: false,
			extraDamage: true,
		});

		await notAttack.spend();

		expect(notAttack.extraDamage).toEqual([]);
		expect(spentIds(attacker)).toEqual([]);
	});

	it('is not used by a caller that shows no extra damage', async () => {
		const attacker = creature('A', [radiant]);
		const noParts = attackHeldPlanOf({ attacker, target: null, area: false, attack: true });

		await noParts.spend();

		expect(noParts.extraDamage).toEqual([]);
		expect(await noParts.rollExtraDamage({})).toEqual([]);
		expect(spentIds(attacker)).toEqual([]);
	});

	it('skips a part whose formula does not roll', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const plan = attackHeldPlanOf({
			attacker: creature('A', [{ ...radiant, formula: '1d@pools.judgment.faces' }]),
			target: null,
			area: false,
			attack: true,
			extraDamage: true,
		});

		expect(await plan.rollExtraDamage({})).toEqual([]);
		expect(warn).toHaveBeenCalled();
	});
});

describe('attackHeldPlanOf with the changes the player ticked', () => {
	const extra: HeldSpec = {
		kind: 'extraDamage',
		label: 'Shining Mandate',
		whichRoll: 'holderAttacks',
		formula: '1d8',
		damageType: 'radiant',
	};

	it('uses and spends only the ticked changes, on the attacker and on the target', async () => {
		const attacker = creature('A', [
			{ ...advantage(), whichRoll: 'holderAttacks' },
			{ ...maximize, whichRoll: 'holderAttacks' },
			extra,
		]);
		const target = creature('T', [{ value: 2 }, { label: 'Opening', value: 3 }]);

		const plan = attackHeldPlanOf({
			attacker,
			target,
			area: false,
			attack: true,
			extraDamage: true,
			chosen: new Set(['A.A-e0.A-e0-rule', 'T.T-e1.T-e1-rule']),
		});
		const options: Record<string, any> = { rollMode: 0 };
		plan.applyToRoll(options as never);
		await plan.spend();

		expect(plan.primaryDieBonus).toBe(3);
		expect(options.rollModeSources).toEqual([0, 1]);
		expect(options.maxDamage).toBeUndefined();
		expect(plan.extraDamage).toEqual([]);
		expect(spentIds(attacker, target)).toEqual(['A-e0', 'T-e1']);
	});

	it('uses and spends nothing when no change is ticked', async () => {
		const attacker = creature('A', [
			ignore,
			mustAttack,
			{ ...advantage(), whichRoll: 'holderAttacks' },
		]);
		const target = creature('T', [{ value: 2 }]);

		const plan = attackHeldPlanOf({
			attacker,
			target,
			area: false,
			attack: true,
			chosen: new Set(),
		});
		const options: Record<string, any> = { rollMode: -1 };
		plan.applyToRoll(options as never);
		await plan.spend();

		expect(plan.primaryDieBonus).toBe(0);
		expect(plan.ignoreDisadvantage).toBeNull();
		expect(plan.mustAttackOther).toBeNull();
		expect(options).toEqual({ rollMode: -1 });
		expect(spentIds(attacker, target)).toEqual([]);
	});

	it('keeps a ticked minus Primary Die change when ignoring disadvantage is not ticked', () => {
		const attacker = creature('A', [ignore]);
		const target = creature('T', [{ label: 'Anticipate Danger', value: -1 }]);

		const plan = attackHeldPlanOf({
			attacker,
			target,
			area: false,
			attack: true,
			chosen: new Set(['T.T-e0.T-e0-rule']),
		});

		expect(plan.primaryDieBonus).toBe(-1);
	});
});
