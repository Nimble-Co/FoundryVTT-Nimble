import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DefendOptionUse } from '../defendRecords.js';

// Setup loads these modules before a hoisted mock could apply.
const applyCondition = vi.fn();
const refundCost = vi.fn();
vi.resetModules();
vi.doMock('../../actor/applyConditionToActor.js', () => ({ default: applyCondition }));
vi.doMock('../../reroll/rerollCost.js', () => ({ refundRerollCost: refundCost }));
const { requestDefend, requestDefendAllyUse, undoDefend } = await import('../defendRequests.js');

const TOKEN = 'Scene.s.Token.pip';
const ogre = { uuid: 'Actor.ogre', name: 'Ogre' };
const pip = { uuid: 'Actor.pip', setFlag: vi.fn(), unsetFlag: vi.fn(), getFlag: vi.fn() };
const bram = { uuid: 'Actor.bram' };

type Globals = { fromUuidSync: ReturnType<typeof vi.fn>; game: Record<string, unknown> };

function makeCard() {
	class Card {
		static getSpeakerActor = vi.fn(() => ogre);
		id = 'm1';
		speaker = { actor: 'ogre' };
		system: Record<string, unknown> = { targets: [TOKEN], defends: [], damageAppliedTo: [] };
		update = vi.fn(async (data: Record<string, unknown>) => {
			this.system.defends = data['system.defends'];
		});
	}
	return new Card();
}

let card = makeCard();

const paidUse: DefendOptionUse = {
	actorUuid: 'Actor.pip',
	ruleId: 'r1',
	itemUuid: 'Item.sand',
	label: 'Pocket Sand',
	cost: {
		chargePoolIdentifier: 'sand',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
	},
	paid: { charges: 1, mana: 0, wounds: 0, heroicReaction: null, action: null },
};

function request(fields: Record<string, unknown> = {}) {
	return {
		messageId: 'm1',
		tokenUuid: TOKEN,
		actorUuid: 'Actor.pip',
		armor: 3,
		label: '',
		combatantId: '',
		actionsSpent: null,
		reactionKeys: [],
		outcome: 'none' as const,
		armorBonus: 0,
		options: [],
		reminders: [],
		attackerConditions: [],
		way: 'action' as const,
		wholeRound: false,
		...fields,
	};
}

beforeEach(() => {
	card = makeCard();
	applyCondition.mockReset();
	refundCost.mockReset();
	const globals = globalThis as unknown as Globals;
	globals.fromUuidSync = vi.fn(
		(uuid: string) => ({ 'Actor.pip': pip, 'Actor.bram': bram })[uuid] ?? null,
	);
	globals.game = {
		user: { id: 'gm', isGM: true },
		messages: { get: () => card },
		combat: null,
		i18n: { localize: (key: string) => key, format: (key: string) => key },
	};
	Object.assign(globals, { ui: { notifications: { warn: vi.fn() } } });
});

describe('Defend options on the card', () => {
	it('writes the option effect and puts the condition on the attacker', async () => {
		await requestDefend(
			request({
				outcome: 'halve',
				armorBonus: 2,
				options: [paidUse],
				reminders: ['Pocket Sand: reroll.'],
				attackerConditions: ['blinded'],
			}),
		);

		const [record] = card.system.defends as Record<string, unknown>[];
		expect(record).toMatchObject({
			outcome: 'halve',
			armorBonus: 2,
			reminders: ['Pocket Sand: reroll.'],
			attackerConditions: ['blinded'],
		});
		expect(applyCondition).toHaveBeenCalledWith(ogre, 'blinded', { sourceActor: pip });
	});

	it('gives back what each option paid on Undo', async () => {
		await requestDefend(request({ options: [paidUse] }));
		const [record] = card.system.defends as { id: string }[];

		await undoDefend('m1', record?.id ?? '');

		expect(refundCost).toHaveBeenCalledWith(pip, paidUse.cost, paidUse.paid);
		expect(card.system.defends).toEqual([]);
	});

	it("gives back only the Defend's action on Undo, not actions spent after it", async () => {
		const hero = {
			id: 'c1',
			type: 'character',
			system: { actions: { base: { current: 1, max: 3 } } },
		};
		const combat = {
			combatants: { get: (id: string) => (id === 'c1' ? hero : undefined) },
			updateEmbeddedDocuments: vi.fn(),
		};
		(globalThis as unknown as Globals).game.combat = combat;
		await requestDefend(request({ combatantId: 'c1', actionsSpent: 1, reactionKeys: ['defend'] }));
		const [record] = card.system.defends as { id: string }[];

		await undoDefend('m1', record?.id ?? '');

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'c1',
				'system.actions.heroic.defendAvailable': true,
				'system.actions.base.current': 2,
			},
		]);
	});

	it('adds an ally option once, with its reminder line', async () => {
		await requestDefend(request());
		const [record] = card.system.defends as { id: string }[];
		const use = { ...paidUse, actorUuid: 'Actor.bram', label: 'Exploit' };
		const ally = {
			messageId: 'm1',
			defendId: record?.id ?? '',
			use,
			reminder: 'Exploit: an enemy Interposes.',
		};

		expect(await requestDefendAllyUse(ally)).toBe(true);
		expect(await requestDefendAllyUse(ally)).toBe(false);

		const [after] = card.system.defends as { options: unknown[]; reminders: string[] }[];
		expect(after?.options).toEqual([use]);
		expect(after?.reminders).toEqual(['Exploit: an enemy Interposes.']);
		expect(refundCost).toHaveBeenCalledTimes(1);
		expect(refundCost).toHaveBeenCalledWith(bram, use.cost, use.paid);
	});

	it('gives back what a refused Defend paid', async () => {
		card.system.targets = [];

		expect(await requestDefend(request({ options: [paidUse] }))).toBe(false);

		expect(refundCost).toHaveBeenCalledWith(pip, paidUse.cost, paidUse.paid);
	});

	it('keeps what a second Defend for the same hero paid: the first Defend holds it', async () => {
		await requestDefend(request());

		expect(await requestDefend(request({ options: [paidUse] }))).toBe(false);

		expect(refundCost).not.toHaveBeenCalled();
	});

	it('does not undo a Defend after its damage is applied', async () => {
		await requestDefend(request({ options: [paidUse] }));
		const [record] = card.system.defends as { id: string }[];
		card.system.damageAppliedTo = [TOKEN];

		await undoDefend('m1', record?.id ?? '');

		expect(refundCost).not.toHaveBeenCalled();
		expect(card.system.defends).toHaveLength(1);
	});
});
