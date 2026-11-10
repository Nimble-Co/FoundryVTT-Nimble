import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeldChange, HeldChangeData, HeldChangeKind } from '#types/heldChange.d.ts';
import { attackHeldPlanOf } from '../attackHeldPlan.js';

interface HeldSpec {
	kind?: HeldChangeKind;
	value?: number;
	label?: string;
	appliesTo?: HeldChangeData['appliesTo'];
	usedUp?: boolean;
}

function heldEffect(id: string, spec: HeldSpec) {
	const label = spec.label ?? 'Create an Opening';
	return {
		id,
		name: label,
		origin: null,
		system: {
			rules: [
				{
					id: `${id}-rule`,
					type: 'heldRoll',
					label,
					heldKind: spec.kind ?? 'primaryDie',
					value: spec.value ?? 1,
					appliesTo: spec.appliesTo ?? 'attacksOnHolder',
					usedUp: spec.usedUp ?? true,
				},
			],
		},
		flags: {},
	};
}

const documents = new Map<string, unknown>();

function creature(uuid: string, held: HeldSpec[] = []) {
	const holder = {
		uuid,
		isOwner: true,
		effects: held.map((spec, index) => heldEffect(`${uuid}-e${index}`, spec)),
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
	appliesTo: 'holderAttacks',
};
const mustAttack: HeldSpec = {
	kind: 'mustAttackOther',
	value: 0,
	label: 'Taunt',
	appliesTo: 'holderAttacks',
};
const kept: HeldSpec = { kind: 'wholeAmount', value: 7, label: 'Kept', appliesTo: 'holderAttacks' };
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
	it('appends the advantage steps to the roll mode sources', () => {
		const target = creature('T', [advantage(1), advantage(2)]);
		const plan = attackHeldPlanOf({ attacker: creature('A'), target, area: false, attack: true });
		const options: Record<string, any> = { rollMode: 0, rollModeSources: [-1] };

		plan.applyToRoll(options as never);

		expect(options.rollModeSources).toEqual([-1, 3]);
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
