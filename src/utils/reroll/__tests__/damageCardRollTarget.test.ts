import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingReactionEntry } from '../../incomingReactions/incomingReactionEntry.js';
import { type DamageCard, damageCardRollTarget } from '../damageCardRollTarget.js';

const TARGET_TOKEN = 'Scene.scene.Token.victim';

function serializedRoll(forceMiss = false) {
	return {
		class: 'DamageRoll',
		formula: '1d6 + 2',
		originalFormula: '1d6 + 2',
		total: 8,
		isCritical: false,
		isMiss: false,
		options: {
			canCrit: false,
			canMiss: false,
			rollMode: 0,
			primaryDieModifier: 0,
			...(forceMiss ? { forceMiss } : {}),
		},
		data: {},
	};
}

function makeCard(effects: unknown[]) {
	const system = {
		targets: [TARGET_TOKEN],
		isCritical: false,
		isMiss: false,
		activation: { effects },
	};
	return {
		system: () => system,
		rollsSource: () => [JSON.stringify(serializedRoll())],
		attacker: () => ({ uuid: 'Actor.attacker' }),
		delivery: () => 'melee' as const,
		movementOfferChanges: vi.fn(() => ({})),
		update: vi.fn(async (_changes: Record<string, unknown>) => undefined),
		followChargeRecovery: vi.fn(async () => undefined),
	} satisfies DamageCard;
}

function damageNode(roll: Record<string, unknown>) {
	return { id: 'damage-node', type: 'damage', parentNode: null, parentContext: null, roll };
}

const usedEntry = {
	id: 'entry-1',
	kind: 'reroll',
	used: true,
} as IncomingReactionEntry;

beforeEach(() => {
	(globalThis as unknown as { fromUuidSync: unknown }).fromUuidSync = vi.fn(() => null);
});

describe('damageCardRollTarget', () => {
	it('finds no roll on a card with no damage roll', () => {
		const target = damageCardRollTarget(makeCard([]));

		expect(target.findRoll()).toBeNull();
		expect(target.context().forcedMiss).toBe(false);
	});

	it('gives the gate the card outcome, delivery and a forced miss', () => {
		const context = damageCardRollTarget(makeCard([damageNode(serializedRoll(true))])).context();

		expect(context).toMatchObject({
			attacker: { uuid: 'Actor.attacker' },
			targets: [{ tokenUuid: TARGET_TOKEN }],
			roll: { kind: 'attack', delivery: 'melee' },
			outcome: { isCritical: false, isMiss: false },
			forcedMiss: true,
		});
	});

	it('tells the gate a crit stays when the roll has a Forced Crit that always applies', () => {
		const forced = serializedRoll();
		Object.assign(forced, { isCritical: true });
		Object.assign(forced.options, { canCrit: true, forcedCrit: 'always' });
		const card = makeCard([damageNode(forced)]);
		Object.assign(card.system(), { isCritical: true });

		expect(damageCardRollTarget(card).context().outcome).toMatchObject({
			isCritical: true,
			critStays: true,
		});
	});

	it('tells the gate whether the roll can crit, from its options', () => {
		const multi = serializedRoll();
		Object.assign(multi.options, { canCrit: false, multiTarget: true });
		const cannot = makeCard([damageNode(multi)]);
		const critting = serializedRoll();
		Object.assign(critting.options, { canCrit: true });
		const can = makeCard([damageNode(critting)]);

		expect(damageCardRollTarget(cannot).context().outcome?.canCrit).toBe(false);
		expect(damageCardRollTarget(can).context().outcome?.canCrit).toBe(true);
	});

	it('gives the gate the item of the attack, when the card has one', () => {
		const card = makeCard([damageNode(serializedRoll())]);
		expect(damageCardRollTarget(card).context().roll).toEqual({
			kind: 'attack',
			delivery: 'melee',
		});

		const withItem = { ...card, itemUuid: () => 'Actor.a.Item.shatter' };
		expect(damageCardRollTarget(withItem).context().roll).toEqual({
			kind: 'attack',
			delivery: 'melee',
			itemUuid: 'Actor.a.Item.shatter',
		});
	});

	it('tells the gate whether a die of the roll is at its max', () => {
		const die = (result: number) => ({
			class: 'Die',
			faces: 6,
			results: [{ result, active: true }],
		});
		const atMax = { ...serializedRoll(), terms: [die(6)] };
		const below = { ...serializedRoll(), terms: [die(5)] };

		expect(damageCardRollTarget(makeCard([damageNode(atMax)])).context().outcome?.anyDieAtMax).toBe(
			true,
		);
		expect(damageCardRollTarget(makeCard([damageNode(below)])).context().outcome?.anyDieAtMax).toBe(
			false,
		);
	});

	it('tells the gate a crit can go away without such a Forced Crit', () => {
		const card = makeCard([damageNode(serializedRoll())]);
		Object.assign(card.system(), { isCritical: true });

		expect(damageCardRollTarget(card).context().outcome?.critStays).toBe(false);
	});

	it('writes nothing until the flow writes, then makes one update with its changes', async () => {
		const card = makeCard([damageNode(serializedRoll())]);
		const roll = damageCardRollTarget(card).findRoll();
		if (!roll) throw new Error('expected a roll');

		const newRoll = await roll.makeRoll('1d6 + 2', serializedRoll().options);
		const prepared = await roll.prepare(newRoll, [usedEntry]);
		expect(card.update).not.toHaveBeenCalled();
		expect(prepared.entries).toEqual([usedEntry]);

		await prepared.write({
			incomingReactions: [usedEntry],
			rerolls: [],
			discardedCritTriggers: false,
			rollChanges: [],
		});

		expect(card.update).toHaveBeenCalledTimes(1);
		const changes = card.update.mock.calls[0]?.[0] as {
			rolls: string[];
			system: Record<string, unknown> & { activation: { effects: Array<Record<string, unknown>> } };
		};
		expect(changes.system).toMatchObject({
			incomingReactions: [usedEntry],
			rerolls: [],
			discardedCritTriggers: false,
			rollChanges: [],
		});
		expect(changes.system.activation.effects[0]?.discardedRoll).toEqual(serializedRoll());
		expect(changes.rolls).toHaveLength(1);
		expect(card.followChargeRecovery).toHaveBeenCalledTimes(1);
	});
});
