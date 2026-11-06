import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeldChangeData } from '#types/heldChange.d.ts';
import { attackHeldPlanOf } from '../attackHeldPlan.js';

const data = (overrides: Partial<HeldChangeData> = {}): HeldChangeData => ({
	kind: 'primaryDie',
	value: 1,
	label: 'Create an Opening',
	sourceName: 'Mira',
	appliesTo: 'attacksOnHolder',
	spentBy: 'oneRoll',
	ends: 'round',
	combatId: 'c1',
	round: 2,
	turn: 0,
	...overrides,
});

function creature(uuid: string, held: HeldChangeData[] = []) {
	return {
		uuid,
		isOwner: true,
		effects: held.map((change, index) => ({
			id: `${uuid}-e${index}`,
			flags: { nimble: { heldChange: change } },
		})),
		createEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

const ignore = data({
	kind: 'ignoreDisadvantage',
	value: 0,
	label: 'Demand Control',
	appliesTo: 'holderAttacks',
});
const mustAttack = data({
	kind: 'mustAttackOther',
	value: 0,
	label: 'Taunt',
	appliesTo: 'holderAttacks',
});
const kept = data({ kind: 'wholeAmount', value: 7, label: 'Kept', appliesTo: 'holderAttacks' });

const globals = globalThis as unknown as Record<string, any>;
let saved: Record<string, unknown>;

beforeEach(() => {
	saved = { fromUuidSync: globals.fromUuidSync };
	globals.game.combats = new Map([['c1', { id: 'c1', started: true, round: 2, turn: 0 }]]);
});

afterEach(() => {
	globals.fromUuidSync = saved.fromUuidSync;
	delete globals.game.combats;
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
		const target = creature('T', [
			data({ value: 2 }),
			data({ label: 'Anticipate Danger', value: -1 }),
		]);
		globals.fromUuidSync = vi.fn((uuid: string) => (uuid === 'A' ? attacker : target));

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
		const target = creature('T', [data()]);
		globals.fromUuidSync = vi.fn((uuid: string) => (uuid === 'A' ? attacker : target));
		const [keptChange] = attacker.effects.slice(1).map((effect) => ({
			...(effect.flags.nimble.heldChange as HeldChangeData),
			effectId: effect.id,
			holderUuid: 'A',
		}));

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
		const target = creature('T', [data()]);

		const plan = attackHeldPlanOf({ attacker, target, area: false, attack: false });

		expect(plan.primaryDie).toEqual([]);
		expect(plan.ignoreDisadvantage).toBeNull();
		expect(plan.mustAttackOther?.label).toBe('Taunt');
	});

	it('drops the Primary Die changes for a roll with no Primary Die, and spends the rest', async () => {
		const attacker = creature('A', [mustAttack]);
		const target = creature('T', [data()]);
		globals.fromUuidSync = vi.fn((uuid: string) => (uuid === 'A' ? attacker : target));

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
