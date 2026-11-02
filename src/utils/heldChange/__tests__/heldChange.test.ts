import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeldChangeData } from '#types/heldChange.d.ts';
import {
	cardDamageTotal,
	createHeldChange,
	expireHeldChanges,
	heldChangesForAttack,
	heldLines,
	keepAmount,
	keptAmountFor,
	spendHeldChanges,
} from '../heldChange.js';

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

function creature(uuid: string, held: HeldChangeData[] = [], isOwner = true) {
	const effects = held.map((change, index) => ({
		id: `e${index}`,
		flags: { nimble: { heldChange: change } },
	}));
	return {
		uuid,
		isOwner,
		effects,
		createEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

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

describe('heldChangesForAttack', () => {
	it("reads the target's changes on attacks against it and the attacker's own", () => {
		const attacker = creature('A', [data({ label: 'Own', appliesTo: 'holderAttacks' })]);
		const target = creature('T', [data()]);

		const held = heldChangesForAttack({ attacker, target, area: false });

		expect(held.map((entry) => entry.label).sort()).toEqual(['Create an Opening', 'Own']);
		expect(held.find((entry) => entry.label === 'Own')?.holderUuid).toBe('A');
	});

	it("does not read the target's own attack changes, or the attacker's incoming ones", () => {
		const attacker = creature('A', [data()]);
		const target = creature('T', [data({ appliesTo: 'holderAttacks' })]);

		expect(heldChangesForAttack({ attacker, target, area: false })).toEqual([]);
	});

	it('gives two Openings on one target, so they add up', () => {
		const target = creature('T', [data(), data()]);
		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		expect(held.reduce((sum, entry) => sum + entry.value, 0)).toBe(2);
	});

	it('gives an area roll no Primary Die change', () => {
		const target = creature('T', [data()]);
		expect(heldChangesForAttack({ attacker: creature('A'), target, area: true })).toEqual([]);
	});

	it('leaves out a round change from an earlier round', () => {
		const target = creature('T', [data({ round: 1 })]);
		expect(heldChangesForAttack({ attacker: creature('A'), target, area: false })).toEqual([]);
	});

	it('leaves out a turn change from an earlier turn', () => {
		const attacker = creature('A', [
			data({ ends: 'turn', turn: 3, appliesTo: 'holderAttacks', kind: 'wholeAmount' }),
		]);
		expect(heldChangesForAttack({ attacker, target: null, area: false })).toEqual([]);
	});

	it('leaves out a change from a combat that ended', () => {
		const target = creature('T', [data({ combatId: 'gone' })]);
		expect(heldChangesForAttack({ attacker: creature('A'), target, area: false })).toEqual([]);
	});

	it('keeps a change with no combat until a roll spends it', () => {
		const attacker = creature('A', [
			data({ combatId: '', round: 0, appliesTo: 'holderAttacks', ends: 'turn' }),
		]);
		expect(heldChangesForAttack({ attacker, target: null, area: false })).toHaveLength(1);
	});
});

describe('spendHeldChanges', () => {
	it('deletes a one-roll change and keeps an every-roll change', async () => {
		const target = creature('T', [data(), data({ spentBy: 'everyRoll' })]);
		globals.fromUuidSync = vi.fn(() => target);

		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		await spendHeldChanges(held);

		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e0']);
	});

	it('asks the GM when the player does not own the holder', async () => {
		const target = creature('T', [data()], false);
		globals.fromUuidSync = vi.fn(() => target);
		const query = vi.fn(async () => true);
		const users = globals.game.users;
		globals.game.users = { activeGM: { query } };

		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		await spendHeldChanges(held);

		globals.game.users = users;
		expect(target.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(query).toHaveBeenCalledWith('nimble.heldChange', {
			action: 'delete',
			actorUuid: 'T',
			effectId: 'e0',
		});
	});
});

describe('createHeldChange', () => {
	it('makes an effect with a token icon on the holder', async () => {
		const target = creature('T');
		await createHeldChange(target as never, data());

		const [[, [effect]]] = target.createEmbeddedDocuments.mock.calls as unknown as [
			[string, [Record<string, any>]],
		];
		expect(effect.name).toBe('Create an Opening');
		expect(effect.showIcon).toBe(2);
		expect(effect.flags.nimble.heldChange.value).toBe(1);
	});
});

describe('expireHeldChanges', () => {
	it('deletes what the new round ended and keeps what lives on', async () => {
		globals.game.combats = new Map([['c1', { id: 'c1', started: true, round: 3, turn: 0 }]]);
		const actor = creature('T', [data({ round: 2 }), data({ ends: 'combat' })]);

		await expireHeldChanges([actor as never]);

		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e0']);
	});
});

describe('heldLines', () => {
	it('tells the source and if the roll spends it', () => {
		const target = creature('T', [data(), data({ spentBy: 'everyRoll', value: -1 })]);
		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });

		expect(heldLines(held)).toEqual([
			{
				key: 'T.e0',
				text: 'Create an Opening: +1 to Primary Die',
				source: 'From Mira. This roll spends it.',
			},
			{
				key: 'T.e1',
				text: 'Create an Opening: -1 to Primary Die',
				source: 'From Mira. It stays until its time ends.',
			},
		]);
	});
});

describe('a kept amount', () => {
	const kept = (overrides: Partial<HeldChangeData> = {}) =>
		data({
			kind: 'wholeAmount',
			value: 13,
			label: 'Rampage',
			appliesTo: 'holderAttacks',
			ends: 'turn',
			...overrides,
		});

	const attack = (activation: Record<string, unknown> = {}) => ({
		system: {
			activation: {
				effects: [{ type: 'damage', canCrit: true, canMiss: true }],
				targets: { attackType: 'reach' },
				...activation,
			},
		},
	});

	it('is offered to the next attack of the holder', () => {
		const attacker = creature('A', [kept()]);
		expect(keptAmountFor(attacker, attack())?.value).toBe(13);
	});

	it('is not offered to an item with no attack, or an area roll', () => {
		const attacker = creature('A', [kept()]);
		expect(keptAmountFor(attacker, attack({ effects: [], targets: {} }))).toBeNull();
		expect(
			keptAmountFor(
				attacker,
				attack({ acquireTargetsFromTemplate: true, template: { shape: 'circle' } }),
			),
		).toBeNull();
	});

	it('ends with the turn', () => {
		expect(keptAmountFor(creature('A', [kept({ turn: 1 })]), attack())).toBeNull();
	});

	it('is not a Primary Die change', () => {
		const attacker = creature('A', [kept()]);
		expect(heldChangesForAttack({ attacker, target: null, area: false })).toEqual([]);
	});

	it('is held with the amount and the turn', async () => {
		globals.game.combat = { id: 'c1', started: true, round: 2, turn: 4 };
		const holder = creature('A');

		await keepAmount(holder as never, 'Rampage', 13);

		delete globals.game.combat;
		const [[, [effect]]] = holder.createEmbeddedDocuments.mock.calls as unknown as [
			[string, [Record<string, any>]],
		];
		expect(effect.flags.nimble.heldChange).toMatchObject({
			kind: 'wholeAmount',
			value: 13,
			spentBy: 'oneRoll',
			ends: 'turn',
			combatId: 'c1',
			round: 2,
			turn: 4,
		});
	});
});

describe('cardDamageTotal', () => {
	it('adds each rolled damage node and the spends folded in', () => {
		expect(
			cardDamageTotal({
				activation: {
					effects: [
						{ id: 'a', type: 'damage', roll: { total: 9 } },
						{ id: 'b', type: 'healing', roll: { total: 5 } },
						{ id: 'c', type: 'damage', roll: { total: 4 } },
					],
				},
				incomingReactions: [{ kind: 'spendPoolForDamage', used: true, usedAmount: 2 }],
			}),
		).toBe(15);
	});
});
