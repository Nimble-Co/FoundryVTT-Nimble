import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeldChangeData } from '#types/heldChange.d.ts';
import { UNDO_APPLICATION_OPTION } from '#utils/actor/effectStacks.js';
import type { AttackDelivery } from '#utils/damage/attackDelivery.js';
import {
	type HeldRollEffectSpec,
	heldRollEffect,
	heldRollSource,
} from '../../../../tests/fixtures/heldRollEffect.js';
import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.js';
import {
	cardDamageTotal,
	createHeldChange,
	heldAdvantageForAttack,
	heldChangeEffect,
	heldChangesForAttack,
	heldExtraDamageForAttack,
	heldLines,
	heldLinesForItem,
	heldMaximizeForAttack,
	heldMaximizeOnAreaTarget,
	heldVulnerabilityTo,
	keepAmount,
	keptAmountEndedBy,
	keptAmountFor,
	mustAttackOtherChange,
	spendHeldChanges,
	spendHeldIgnoreDisadvantage,
	takeBackHeldChanges,
} from '../heldChange.js';

type HeldSpec = HeldRollEffectSpec;

const MIRA = 'Actor.mira';

/** An effect with one Held Roll rule, from Mira unless the spec says otherwise. */
function heldEffect(id: string, spec: HeldSpec = {}) {
	return heldRollEffect(id, { origin: MIRA, ...spec });
}

const documents = new Map<string, unknown>();

function creature(uuid: string, held: HeldSpec[] = [], isOwner = true) {
	const holder = {
		uuid,
		isOwner,
		effects: held.map((spec, index) => heldEffect(`e${index}`, spec)),
		createEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
	documents.set(uuid, holder);
	return holder;
}

function changeData(overrides: Partial<HeldChangeData> = {}): HeldChangeData {
	return {
		kind: 'primaryDie',
		value: 1,
		label: 'Create an Opening',
		appliesTo: 'attacksOnHolder',
		spentBy: 'oneRoll',
		ends: 'round',
		origin: MIRA,
		...overrides,
	};
}

function createdEffect(holder: ReturnType<typeof creature>): Record<string, any> {
	const [[, [effect]]] = holder.createEmbeddedDocuments.mock.calls as unknown as [
		[string, [Record<string, any>]],
	];
	return effect;
}

const globals = globalThis as unknown as Record<string, any>;
let saved: Record<string, unknown>;

beforeEach(() => {
	saved = { fromUuidSync: globals.fromUuidSync, combat: globals.game.combat };
	documents.clear();
	documents.set(MIRA, { uuid: MIRA, name: 'Mira', documentName: 'Actor' });
	globals.fromUuidSync = vi.fn((uuid: string) => documents.get(uuid) ?? null);
	globals.game.combat = { id: 'c1', started: true, round: 2, turn: 0 };
});

afterEach(() => {
	globals.fromUuidSync = saved.fromUuidSync;
	globals.game.combat = saved.combat;
});

describe('heldChangesForAttack', () => {
	it('drops a minus on the Primary Die on a roll that ignores negative effects', () => {
		const target = creature('T', [
			{ label: 'Anticipate Danger', value: -1, usedUp: false },
			{ label: 'Create an Opening', value: 1 },
		]);

		const withNullify = heldChangesForAttack({
			attacker: creature('A'),
			target,
			area: false,
			ignoresNegative: true,
		});
		const without = heldChangesForAttack({ attacker: creature('A'), target, area: false });

		expect(withNullify.map((held) => held.label)).toEqual(['Create an Opening']);
		expect(without.map((held) => held.value)).toEqual([-1, 1]);
	});

	it("reads the target's changes on attacks against it and the attacker's own", () => {
		const attacker = creature('A', [{ label: 'Own', whichRoll: 'holderAttacks' }]);
		const target = creature('T', [{}]);

		const held = heldChangesForAttack({ attacker, target, area: false });

		expect(held.map((entry) => entry.label).sort()).toEqual(['Create an Opening', 'Own']);
		expect(held.find((entry) => entry.label === 'Own')?.holderUuid).toBe('A');
	});

	it("does not read the target's own attack changes, or the attacker's incoming ones", () => {
		const attacker = creature('A', [{}]);
		const target = creature('T', [{ whichRoll: 'holderAttacks' }]);

		expect(heldChangesForAttack({ attacker, target, area: false })).toEqual([]);
	});

	it('gives two Openings on one target, so they add up', () => {
		const target = creature('T', [{}, {}]);
		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		expect(held.reduce((sum, entry) => sum + entry.value, 0)).toBe(2);
	});

	it('gives an area roll no Primary Die change', () => {
		const target = creature('T', [{}]);
		expect(heldChangesForAttack({ attacker: creature('A'), target, area: true })).toEqual([]);
	});

	it('does not read a disabled effect', () => {
		const target = creature('T', [{ disabled: true }]);
		expect(heldChangesForAttack({ attacker: creature('A'), target, area: false })).toEqual([]);
	});
});

describe('the Held Change read from an effect', () => {
	it('takes the source name from the origin document', () => {
		const target = creature('T', [{}]);
		const [held] = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		expect(held.sourceName).toBe('Mira');
	});

	it('takes the source name from the effect name when it has no origin', () => {
		const target = creature('T', [{ origin: null, label: 'Opening' }]);
		const [held] = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		expect(held.sourceName).toBe('Opening');
	});

	it('is spent by one roll when used up, and stays for every roll when not', () => {
		const target = creature('T', [{ usedUp: true }, { usedUp: false }]);
		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		expect(held.map((entry) => entry.spentBy)).toEqual(['oneRoll', 'everyRoll']);
	});

	it('carries the message id of the card that made it', () => {
		const target = creature('T', [{ messageId: 'm1' }]);
		const [held] = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		expect(held.sourceMessageId).toBe('m1');
	});
});

describe('the Held Roll rules that are read', () => {
	const advantage: HeldSpec = { kind: 'advantage', label: 'Advantage' };

	/** An effect whose prepared rule's predicate gives `passes`. */
	function preparedEffect(passes: boolean) {
		const rule = { ...heldRollSource('r1', advantage, 'Advantage'), appliesTo: () => passes };
		return { ...heldEffect('e0', advantage), rules: new Map([[rule.id, rule]]) };
	}

	function holderOf(effect: ReturnType<typeof heldEffect> & { rules?: Map<string, unknown> }) {
		return { uuid: 'T', isOwner: true, effects: [effect] };
	}

	it('skips a disabled Held Roll rule', () => {
		const target = creature('T', [{ ...advantage, ruleDisabled: true }]);
		expect(heldAdvantageForAttack({ attacker: creature('A'), target, area: false })).toEqual([]);
	});

	it('skips an effect that is not active', () => {
		const target = creature('T', [{ ...advantage, active: false }]);
		expect(heldAdvantageForAttack({ attacker: creature('A'), target, area: false })).toEqual([]);
	});

	it('skips a prepared rule whose predicate fails', () => {
		const target = holderOf(preparedEffect(false));
		expect(heldAdvantageForAttack({ attacker: creature('A'), target, area: false })).toEqual([]);
	});

	it('reads a prepared rule whose predicate passes', () => {
		const target = holderOf(preparedEffect(true));
		const held = heldAdvantageForAttack({ attacker: creature('A'), target, area: false });
		expect(held.map((entry) => entry.effectId)).toEqual(['e0']);
	});

	it('reads the prepared rules, not the source rules, when the effect has them', () => {
		const target = holderOf({ ...heldEffect('e0', advantage), rules: new Map() });
		expect(heldAdvantageForAttack({ attacker: creature('A'), target, area: false })).toEqual([]);
	});
});

describe('heldAdvantageForAttack', () => {
	const advantage = (spec: HeldSpec = {}): HeldSpec => ({
		kind: 'advantage',
		label: 'Advantage',
		...spec,
	});

	it("reads the attacker's own changes on its attacks", () => {
		const attacker = creature('A', [advantage({ whichRoll: 'holderAttacks' })]);
		const held = heldAdvantageForAttack({ attacker, target: creature('T'), area: false });
		expect(held.map((entry) => entry.holderUuid)).toEqual(['A']);
	});

	it("reads the target's changes on attacks against it", () => {
		const target = creature('T', [advantage({ whichRoll: 'attacksOnHolder' })]);
		const held = heldAdvantageForAttack({ attacker: creature('A'), target, area: false });
		expect(held.map((entry) => entry.holderUuid)).toEqual(['T']);
	});

	it("does not read the attacker's changes on attacks against it", () => {
		const attacker = creature('A', [advantage({ whichRoll: 'attacksOnHolder' })]);
		expect(heldAdvantageForAttack({ attacker, target: creature('T'), area: false })).toEqual([]);
	});

	it("does not read the target's changes on an area attack", () => {
		const attacker = creature('A', [advantage({ whichRoll: 'holderAttacks', label: 'Own' })]);
		const target = creature('T', [advantage()]);
		const held = heldAdvantageForAttack({ attacker, target, area: true });
		expect(held.map((entry) => entry.label)).toEqual(['Own']);
	});

	it('does not read a melee-only change on an attack that is not melee', () => {
		const target = creature('T', [advantage({ meleeOnly: true })]);
		const held = heldAdvantageForAttack({
			attacker: creature('A'),
			target,
			area: false,
			delivery: 'ranged',
		});
		expect(held).toEqual([]);
	});

	it('does not read a melee-only change on an attack with no delivery', () => {
		const target = creature('T', [advantage({ meleeOnly: true })]);
		const held = heldAdvantageForAttack({
			attacker: creature('A'),
			target,
			area: false,
			delivery: null,
		});
		expect(held).toEqual([]);
	});

	it('reads a ranged-only change only on an attack known to be ranged', () => {
		const target = creature('T', [advantage({ rangedOnly: true })]);
		const on = (delivery: AttackDelivery) =>
			heldAdvantageForAttack({ attacker: creature('A'), target, area: false, delivery });
		expect(on('ranged')).toHaveLength(1);
		expect(on('melee')).toEqual([]);
		expect(on(null)).toEqual([]);
	});

	it('reads a change that is both melee-only and ranged-only as melee-only', () => {
		const target = creature('T', [advantage({ meleeOnly: true, rangedOnly: true })]);
		const on = (delivery: AttackDelivery) =>
			heldAdvantageForAttack({ attacker: creature('A'), target, area: false, delivery });
		expect(on('melee')).toHaveLength(1);
		expect(on('ranged')).toEqual([]);
	});

	it('reads a source-only change only on an attack by the origin creature', () => {
		const target = creature('T', [advantage({ fromSourceOnly: true })]);
		const mira = creature(MIRA);
		documents.set(MIRA, { ...mira, name: 'Mira', documentName: 'Actor' });

		const fromMira = heldAdvantageForAttack({ attacker: mira, target, area: false });
		const fromOther = heldAdvantageForAttack({ attacker: creature('B'), target, area: false });

		expect(fromMira).toHaveLength(1);
		expect(fromOther).toEqual([]);
	});

	it('reads a source-only change on no attack when its origin is lost', () => {
		const target = creature('T', [advantage({ fromSourceOnly: true, origin: 'Item.gone' })]);

		const held = heldAdvantageForAttack({ attacker: creature('A'), target, area: false });

		expect(held).toEqual([]);
	});

	it('takes the origin creature of an item origin from the item actor', () => {
		documents.set('Item.feature', {
			uuid: 'Item.feature',
			name: 'Feature',
			documentName: 'Item',
			actor: { uuid: 'A' },
		});
		const target = creature('T', [advantage({ fromSourceOnly: true, origin: 'Item.feature' })]);

		const [held] = heldAdvantageForAttack({ attacker: creature('A'), target, area: false });

		expect(held.onlyFromUuid).toBe('A');
	});
});

describe('heldMaximizeForAttack', () => {
	const maximize = (spec: HeldSpec = {}): HeldSpec => ({
		kind: 'maximize',
		label: 'Maximize',
		...spec,
	});

	it("reads the target's change on attacks against it", () => {
		const target = creature('T', [maximize()]);
		expect(heldMaximizeForAttack({ attacker: creature('A'), target, area: false })?.label).toBe(
			'Maximize',
		);
	});

	it("reads the attacker's own change on its attacks", () => {
		const attacker = creature('A', [maximize({ whichRoll: 'holderAttacks' })]);
		expect(heldMaximizeForAttack({ attacker, target: null, area: false })?.holderUuid).toBe('A');
	});

	it('gives an area attack no maximize change', () => {
		const target = creature('T', [maximize()]);
		expect(heldMaximizeForAttack({ attacker: creature('A'), target, area: true })).toBeNull();
	});

	it('does not read a melee-only change on an attack that is not melee', () => {
		const target = creature('T', [maximize({ meleeOnly: true })]);
		expect(
			heldMaximizeForAttack({
				attacker: creature('A'),
				target,
				area: false,
				delivery: 'ranged',
			}),
		).toBeNull();
	});

	it('reads a source-only change only on an attack by the origin creature', () => {
		const target = creature('T', [maximize({ fromSourceOnly: true })]);
		documents.set(MIRA, { uuid: MIRA, name: 'Mira', documentName: 'Actor' });

		expect(heldMaximizeForAttack({ attacker: { uuid: MIRA }, target, area: false })).not.toBeNull();
		expect(heldMaximizeForAttack({ attacker: creature('B'), target, area: false })).toBeNull();
	});
});

describe('heldMaximizeOnAreaTarget', () => {
	const maximize = (spec: HeldSpec = {}): HeldSpec => ({
		kind: 'maximize',
		label: 'Doomed',
		...spec,
	});

	it("reads a target's change on attacks against it", () => {
		const target = creature('T', [maximize()]);
		expect(heldMaximizeOnAreaTarget(target, creature('A'), null)?.label).toBe('Doomed');
	});

	it("does not read a target's change on its own attacks", () => {
		const target = creature('T', [maximize({ whichRoll: 'holderAttacks' })]);
		expect(heldMaximizeOnAreaTarget(target, creature('A'), null)).toBeNull();
	});

	it('does not read a melee-only change on an area with no delivery', () => {
		const target = creature('T', [maximize({ meleeOnly: true })]);
		expect(heldMaximizeOnAreaTarget(target, creature('A'), null)).toBeNull();
		expect(heldMaximizeOnAreaTarget(target, creature('A'), 'melee')?.label).toBe('Doomed');
	});

	it('reads a source-only change only on an area of the origin creature', () => {
		const target = creature('T', [maximize({ fromSourceOnly: true })]);
		expect(heldMaximizeOnAreaTarget(target, { uuid: MIRA }, null)).not.toBeNull();
		expect(heldMaximizeOnAreaTarget(target, creature('B'), null)).toBeNull();
	});
});

describe('spendHeldChanges', () => {
	it('deletes a one-roll change and keeps an every-roll change', async () => {
		const target = creature('T', [{}, { usedUp: false }]);

		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		await spendHeldChanges(held);

		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e0']);
	});

	it('puts an ended line with Undo in the lines of the use before it deletes the change', async () => {
		const target = creature('T', [{ label: 'True Strike' }]);
		documents.set('T.ActiveEffect.e0', {
			id: 'e0',
			uuid: 'T.ActiveEffect.e0',
			name: 'True Strike',
			img: 'strike.webp',
			origin: MIRA,
			parent: { uuid: 'T', name: 'Grug' },
			toObject: () => ({ name: 'True Strike' }),
		});
		const add = vi.fn(async () => true);

		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		await spendHeldChanges(held, { add });

		expect(add).toHaveBeenCalledWith([
			expect.objectContaining({
				kind: 'effectEnded',
				text: {
					key: 'NIMBLE.lastsUntil.chat.ended',
					data: { effect: 'True Strike', name: 'Grug' },
				},
				cause: expect.objectContaining({
					data: expect.objectContaining({ reason: { key: 'NIMBLE.chat.events.cause.usedUp' } }),
				}),
				action: expect.objectContaining({ kind: 'undoEnd' }),
			}),
		]);
		expect(add.mock.invocationCallOrder[0]).toBeLessThan(
			target.deleteEmbeddedDocuments.mock.invocationCallOrder[0],
		);
	});

	it('deletes an effect once when the roll spends two of its rules', async () => {
		const target = creature('T', [{ moreRules: [{ value: 2 }] }]);
		target.effects[0].system.rules[1].heldKind = 'primaryDie';

		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });
		expect(held).toHaveLength(2);
		await spendHeldChanges(held);

		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e0']);
	});

	it('asks the GM when the player does not own the holder', async () => {
		const target = creature('T', [{}], false);
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

describe('spendHeldIgnoreDisadvantage', () => {
	it('puts the ended line of the change in the lines of the use that spends it', async () => {
		const hero = creature('H', [
			{ kind: 'ignoreDisadvantage', whichRoll: 'holderAttacks', label: 'Nullify' },
		]);
		documents.set('H.ActiveEffect.e0', {
			id: 'e0',
			uuid: 'H.ActiveEffect.e0',
			name: 'Nullify',
			img: 'nullify.webp',
			origin: MIRA,
			parent: { uuid: 'H', name: 'Tessa' },
			toObject: () => ({ name: 'Nullify' }),
		});
		const add = vi.fn(async () => true);

		await spendHeldIgnoreDisadvantage(hero as never, 'Shove', { add });

		expect(add).toHaveBeenCalledWith([
			expect.objectContaining({
				kind: 'effectEnded',
				cause: expect.objectContaining({
					data: expect.objectContaining({
						reason: { key: 'NIMBLE.chat.events.cause.usedByAction' },
					}),
				}),
			}),
		]);
		expect(hero.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e0']);
	});
});

describe('takeBackHeldChanges', () => {
	const undoApplication = { [UNDO_APPLICATION_OPTION]: true };

	it('deletes only the changes that the card made', async () => {
		const target = creature('T', [{ messageId: 'm1' }, { messageId: 'm2' }]);

		const count = await takeBackHeldChanges(target, 'm1');

		expect(count).toBe(1);
		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith(
			'ActiveEffect',
			['e0'],
			undoApplication,
		);
	});

	it('deletes a disabled effect that the card made', async () => {
		const target = creature('T', [{ messageId: 'm1', disabled: true }]);

		const count = await takeBackHeldChanges(target, 'm1');

		expect(count).toBe(1);
		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith(
			'ActiveEffect',
			['e0'],
			undoApplication,
		);
	});

	it('deletes an effect with a disabled rule that the card made', async () => {
		const target = creature('T', [{ messageId: 'm1', ruleDisabled: true }]);

		await takeBackHeldChanges(target, 'm1');

		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledWith(
			'ActiveEffect',
			['e0'],
			undoApplication,
		);
	});

	it('deletes an effect with two Held Roll rules once', async () => {
		const target = creature('T', [{ messageId: 'm1', moreRules: [{ kind: 'advantage' }] }]);

		const count = await takeBackHeldChanges(target, 'm1');

		expect(count).toBe(1);
		expect(target.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
	});

	it('asks the GM to delete it as an undone application when the player does not own the holder', async () => {
		const target = creature('T', [{ messageId: 'm1' }], false);
		const query = vi.fn(async () => true);
		const users = globals.game.users;
		globals.game.users = { activeGM: { query } };

		await takeBackHeldChanges(target, 'm1');

		globals.game.users = users;
		expect(query).toHaveBeenCalledWith('nimble.heldChange', {
			action: 'delete',
			actorUuid: 'T',
			effectId: 'e0',
			undo: true,
		});
	});
});

describe('heldChangeEffect', () => {
	it('makes a Nimble effect with a token icon and the origin', () => {
		const effect = heldChangeEffect(changeData()) as Record<string, any>;

		expect(effect.type).toBe(NIMBLE_EFFECT_TYPE);
		expect(effect.name).toBe('Create an Opening');
		expect(effect.showIcon).toBe(2);
		expect(effect.origin).toBe(MIRA);
	});

	it('holds the change as one Held Roll rule', () => {
		const effect = heldChangeEffect(
			changeData({ kind: 'vulnerableOnce', value: 0, damageType: 'fire' }),
		) as Record<string, any>;

		expect(effect.system.rules).toHaveLength(1);
		expect(effect.system.rules[0]).toMatchObject({
			type: 'heldRoll',
			label: 'Create an Opening',
			heldKind: 'vulnerableOnce',
			value: 0,
			whichRoll: 'attacksOnHolder',
			usedUp: true,
			damageType: 'fire',
		});
		expect(typeof effect.system.rules[0].id).toBe('string');
	});

	it('is not used up when it stays for every roll', () => {
		const effect = heldChangeEffect(changeData({ spentBy: 'everyRoll' })) as Record<string, any>;
		expect(effect.system.rules[0].usedUp).toBe(false);
	});

	it('lasts until the end of the current turn of any creature when it ends with the turn', () => {
		const effect = heldChangeEffect(changeData({ ends: 'turn' })) as Record<string, any>;
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({
				kind: 'turn',
				boundary: 'end',
				clock: 'any',
				span: 'currentTurn',
			}),
		]);
	});

	it('lasts until the end of the round when it ends with the round', () => {
		const effect = heldChangeEffect(changeData({ ends: 'round' })) as Record<string, any>;
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'turn', boundary: 'end', clock: null, span: 'currentRound' }),
		]);
	});

	it('lasts until the combat ends when it ends with the combat', () => {
		const effect = heldChangeEffect(changeData({ ends: 'combat' })) as Record<string, any>;
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'combatEnd' }),
		]);
	});

	it('flags the card that made it', () => {
		const effect = heldChangeEffect(changeData({ sourceMessageId: 'm1' })) as Record<string, any>;
		expect(effect.flags).toEqual({ nimble: { heldChangeMessage: 'm1' } });
	});

	it('has no flags when no card made it', () => {
		const effect = heldChangeEffect(changeData()) as Record<string, any>;
		expect(effect.flags).toBeUndefined();
	});
});

describe('createHeldChange', () => {
	it('puts the effect of the change on the holder', async () => {
		const target = creature('T');
		await createHeldChange(target, changeData());

		expect(createdEffect(target).system.rules[0].heldKind).toBe('primaryDie');
	});

	it('holds nothing outside combat', async () => {
		globals.game.combat = null;
		const holder = creature('A');
		await createHeldChange(holder, changeData());
		expect(holder.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('holds nothing in a combat that has not started', async () => {
		globals.game.combat = { id: 'c1', started: false };
		const holder = creature('A');
		await createHeldChange(holder, changeData());
		expect(holder.createEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

describe('heldLines', () => {
	it('tells the source and if the roll spends it', () => {
		const target = creature('T', [{}, { usedUp: false, value: -1 }]);
		const held = heldChangesForAttack({ attacker: creature('A'), target, area: false });

		expect(heldLines(held)).toEqual([
			{
				key: 'T.e0.e0-rule',
				text: 'Create an Opening: +1 to Primary Die',
				source: 'From Mira. This roll spends it.',
			},
			{
				key: 'T.e1.e1-rule',
				text: 'Create an Opening: -1 to Primary Die',
				source: 'From Mira. It stays until its time ends.',
			},
		]);
	});

	it('gives each Held Roll rule of one effect its own line and key', () => {
		const target = creature('T', [{ moreRules: [{ value: 2 }] }]);

		const lines = heldLines(heldChangesForAttack({ attacker: creature('A'), target, area: false }));

		expect(lines.map((line) => line.text)).toEqual([
			'Create an Opening: +1 to Primary Die',
			'Create an Opening: +2 to Primary Die',
		]);
		expect(new Set(lines.map((line) => line.key)).size).toBe(2);
	});

	it('keys a rule with no id by its place on the effect', () => {
		const target = creature('T', [{ moreRules: [{ value: 2 }] }]);
		for (const rule of target.effects[0].system.rules) (rule as { id?: string }).id = '';

		const lines = heldLines(heldChangesForAttack({ attacker: creature('A'), target, area: false }));

		expect(lines.map((line) => line.key)).toEqual(['T.e0.0', 'T.e0.1']);
	});

	function lineOf(spec: HeldSpec): string {
		const holder = creature('A', [{ whichRoll: 'holderAttacks', ...spec }]);
		const attack = { attacker: holder, target: null, area: false };
		const held =
			spec.kind === 'maximize' ? heldMaximizeForAttack(attack) : heldAdvantageForAttack(attack)[0];
		return heldLines(held ? [held] : [])[0]?.text ?? '';
	}

	it('words a plus advantage with its sign', () => {
		expect(lineOf({ kind: 'advantage', label: 'True Strike', value: 1 })).toBe(
			'True Strike: +1 advantage',
		);
	});

	it('words a minus advantage as disadvantage of its size', () => {
		expect(lineOf({ kind: 'advantage', label: 'Hindered', value: -1 })).toBe(
			'Hindered: 1 disadvantage',
		);
	});

	it('words a maximize change', () => {
		expect(lineOf({ kind: 'maximize', label: 'Condemn', value: 0 })).toBe(
			'Condemn: every die rolls its highest number',
		);
	});

	it('shows an extra damage change on the window of the next attack', () => {
		const holder = creature('A', [
			{
				kind: 'extraDamage',
				label: 'Shining Mandate',
				whichRoll: 'holderAttacks',
				formula: '1d8',
				damageType: 'radiant',
			},
		]);
		const attack = {
			system: {
				activation: {
					effects: [{ type: 'damage', canMiss: true }],
					targets: { attackType: 'reach' },
				},
			},
		};

		expect(heldLinesForItem(holder, attack).map((line) => line.text)).toEqual([
			'Shining Mandate: 1d8 Radiant damage on a hit',
		]);
	});
});

describe('the delivery a Held Roll filter reads (decisions 127, 133)', () => {
	const own = (spec: HeldSpec): HeldSpec => ({
		kind: 'advantage',
		whichRoll: 'holderAttacks',
		...spec,
	});
	const withType = (type: string) =>
		Object.assign(
			creature('A', [
				own({ label: 'Melee', meleeOnly: true }),
				own({ label: 'Ranged', rangedOnly: true }),
			]),
			{ type },
		);
	const untyped = (activation: Record<string, unknown> = {}) => ({
		system: {
			activation: {
				effects: [{ type: 'damage', canCrit: true, canMiss: true }],
				targets: {},
				...activation,
			},
		},
	});
	const lineTexts = (attacker: ReturnType<typeof withType>, item: ReturnType<typeof untyped>) =>
		heldLinesForItem(attacker, item).map((line) => line.text);

	it('reads a melee-only change on a monster attack with no attack type (Reach 1)', () => {
		expect(lineTexts(withType('npc'), untyped())).toEqual(['Melee: +1 advantage']);
	});

	it('reads neither filter on a monster area attack with no attack type', () => {
		const area = untyped({ acquireTargetsFromTemplate: true, template: { shape: 'circle' } });
		expect(lineTexts(withType('npc'), area)).toEqual([]);
	});

	it('reads neither filter on a hero attack with no attack type', () => {
		expect(lineTexts(withType('character'), untyped())).toEqual([]);
	});
});

describe('the formula of an extra damage change', () => {
	it('reads the stacks of the effect that holds it', () => {
		const holder = creature('A', [
			{ kind: 'extraDamage', label: 'Stacked', whichRoll: 'holderAttacks', formula: '(@stacks)d6' },
		]);
		Object.assign(holder.effects[0].system, { stacks: { on: true, count: 3 } });

		const [held] = heldExtraDamageForAttack({ attacker: holder, target: null, area: false });

		expect(held.formula).toBe('(3)d6');
	});
});

describe('a kept amount', () => {
	const kept = (spec: HeldSpec = {}): HeldSpec => ({
		kind: 'wholeAmount',
		value: 13,
		label: 'Rampage',
		whichRoll: 'holderAttacks',
		...spec,
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

	it('is offered to single-target damage with only a save (C:452)', () => {
		const attacker = creature('A', [kept()]);
		const saveOnly = attack({ effects: [{ type: 'damage' }], targets: {} });
		expect(keptAmountFor(attacker, saveOnly)?.value).toBe(13);
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

	it('is ended by an area attack, not by another item', () => {
		const attacker = creature('A', [kept()]);
		const area = attack({ acquireTargetsFromTemplate: true, template: { shape: 'circle' } });
		expect(keptAmountEndedBy(attacker, area)?.value).toBe(13);
		expect(keptAmountEndedBy(attacker, attack())).toBeNull();
		expect(keptAmountEndedBy(attacker, attack({ effects: [], targets: {} }))).toBeNull();
		const areaSpell = attack({
			effects: [{ type: 'damage', canCrit: false, canMiss: false }],
			targets: {},
			acquireTargetsFromTemplate: true,
			template: { shape: 'circle' },
		});
		expect(keptAmountEndedBy(attacker, areaSpell)?.value).toBe(13);
	});

	it('tells the player that an area attack ends it', () => {
		const attacker = creature('A', [kept()]);
		const area = attack({ acquireTargetsFromTemplate: true, template: { shape: 'circle' } });
		expect(heldLinesForItem(attacker, area)).toHaveLength(1);
	});

	it('is not a Primary Die change', () => {
		const attacker = creature('A', [kept()]);
		expect(heldChangesForAttack({ attacker, target: null, area: false })).toEqual([]);
	});

	it('is held with the amount until the end of the turn', async () => {
		const holder = creature('A');

		await keepAmount(holder, 'Rampage', 13, 'Item.rampage');

		const effect = createdEffect(holder);
		expect(effect.origin).toBe('Item.rampage');
		expect(effect.system.rules[0]).toMatchObject({
			heldKind: 'wholeAmount',
			value: 13,
			whichRoll: 'holderAttacks',
			usedUp: true,
		});
		expect(effect.system.lastsUntil[0]).toMatchObject({ span: 'currentTurn', clock: 'any' });
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

	it('multiplies the damage node', () => {
		expect(
			cardDamageTotal({
				activation: { effects: [{ type: 'damage', roll: { total: 6 }, damageMultiplier: 2 }] },
			}),
		).toBe(12);
	});
});

describe('a change that waits on the target of a feature', () => {
	const mustAttack: HeldSpec = { kind: 'mustAttackOther', whichRoll: 'holderAttacks' };
	const greased: HeldSpec = {
		kind: 'vulnerableOnce',
		whichRoll: 'attacksOnHolder',
		damageType: 'fire',
	};

	it('tells the next attacker who it must attack, on its window', () => {
		const attacker = creature('A', [mustAttack]);
		expect(mustAttackOtherChange(attacker)?.kind).toBe('mustAttackOther');
		const item = {
			system: {
				activation: {
					effects: [{ type: 'damage', canMiss: true }],
					targets: { attackType: 'reach' },
				},
			},
		};
		expect(heldLinesForItem(attacker, item)).toHaveLength(1);
	});

	it('tells a damage item with no attack roll too', () => {
		const attacker = creature('A', [mustAttack]);
		const item = { system: { activation: { effects: [{ type: 'damage' }], targets: {} } } };
		expect(heldLinesForItem(attacker, item)).toHaveLength(1);
	});

	it('finds a vulnerability only for its damage type', () => {
		const holder = creature('A', [greased]);
		expect(heldVulnerabilityTo(holder, 'fire')?.kind).toBe('vulnerableOnce');
		expect(heldVulnerabilityTo(holder, 'cold')).toBeNull();
	});
});
