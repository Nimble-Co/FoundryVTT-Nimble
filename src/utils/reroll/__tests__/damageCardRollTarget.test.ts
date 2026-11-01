import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingReactionEntry } from '../../incomingReactions/incomingReactionEntry.js';
import { type DamageCard, damageCardRollTarget, noDamageEntries } from '../damageCardRollTarget.js';

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

describe('the stats of an attack', () => {
	const roll = (originalFormula: string, data: Record<string, unknown> = {}) => ({
		...serializedRoll(),
		originalFormula,
		data,
	});

	it('come from the formula that keeps its stat parts, not from the resolved one', () => {
		const card = makeCard([damageNode(roll('1d10+@strength'))]);
		const context = damageCardRollTarget(card).context();
		expect(context.roll).toMatchObject({ kind: 'attack', stats: ['strength'] });
	});

	it('fall back on the node formula', () => {
		const card = makeCard([
			{
				...damageNode({ ...serializedRoll(), originalFormula: undefined, formula: '1d10 + 3' }),
				formula: '1d10+@dexterity',
			},
		]);
		const context = damageCardRollTarget(card).context();
		expect(context.roll).toMatchObject({ stats: ['dexterity'] });
	});

	it('are none on a resolved formula', () => {
		const card = makeCard([damageNode(roll('1d10+3'))]);
		expect(damageCardRollTarget(card).context().roll).not.toHaveProperty('stats');
	});

	it('list the other stats with their values, from the data the new roll uses', () => {
		const data = { strength: -1, dexterity: 2, intelligence: 0, will: 1 };
		const found = damageCardRollTarget(
			makeCard([damageNode(roll('1d8+@strength', data))]),
		).findRoll();
		expect(found?.statChoices?.()).toEqual([
			{ stat: 'dexterity', mod: 2 },
			{ stat: 'intelligence', mod: 0 },
			{ stat: 'will', mod: 1 },
		]);
	});

	it('swap the stat part of the formula, and keep the other parts', () => {
		const data = { strength: -1, dexterity: 2, intelligence: 0, will: 1 };
		const found = damageCardRollTarget(
			makeCard([damageNode(roll('1d8+@strength+2', data))]),
		).findRoll();
		const swapped = found?.withStat?.(found, 'dexterity');
		expect(swapped?.replaced.originalFormula).toBe('1d8+@dexterity+2');
	});

	it('refuse a stat that is not one of the choices', () => {
		const data = { strength: -1, dexterity: 2 };
		const found = damageCardRollTarget(
			makeCard([damageNode(roll('1d8+@strength', data))]),
		).findRoll();
		expect(found?.withStat?.(found, 'strength')).toBeNull();
		expect(found?.withStat?.(found, 'will')).toBeNull();
		expect(found?.withStat?.(found, '')).toBeNull();
	});

	it('use the rule stat when the formula has two', () => {
		const data = { strength: 1, dexterity: 2, will: 3 };
		const found = damageCardRollTarget(
			makeCard([damageNode(roll('1d8+max(@strength,@dexterity)', data))]),
		).findRoll();
		const choices = found?.statChoices?.('dexterity').map((choice) => choice.stat);
		expect(choices).toEqual(['strength', 'will']);
	});
});

describe('noDamageEntries', () => {
	const offer = { offersUseOn: (context: { side: string }) => context.side === 'target' };
	const noDamageRule = {
		type: 'changeResult',
		change: 'noDamage',
		id: 'res',
		item: { name: 'Epic Resistance', uuid: 'Item.res' },
		attackTrigger: 'hit',
		...offer,
	};
	const otherRule = { type: 'reroll', id: 'lucky', outcome: 'always', ...offer };

	function world() {
		const byUuid: Record<string, unknown> = {
			'Token.a': { actor: { uuid: 'Actor.a', rules: [noDamageRule, otherRule] } },
			'Token.b': { actor: { uuid: 'Actor.b', rules: [noDamageRule] } },
		};
		(globalThis as unknown as { fromUuidSync: unknown }).fromUuidSync = vi.fn(
			(uuid: string) => byUuid[uuid] ?? null,
		);
	}

	it('gives each target its own row, on a roll with two targets, and no other row', () => {
		world();
		const entries = noDamageEntries(makeCard([damageNode(serializedRoll())]), [
			'Token.a',
			'Token.b',
		]);
		expect(entries.map((entry) => [entry.targetTokenUuid, entry.ruleId, entry.use])).toEqual([
			['Token.a', 'res', 'result'],
			['Token.b', 'res', 'result'],
		]);
	});

	it('gives none on a card with no damage roll', () => {
		world();
		expect(noDamageEntries(makeCard([]), ['Token.a'])).toEqual([]);
	});

	it('gives none on a miss', () => {
		world();
		const card = makeCard([damageNode(serializedRoll())]);
		Object.assign(card.system(), { isMiss: true });
		expect(noDamageEntries(card, ['Token.a'])).toEqual([]);
	});
});
