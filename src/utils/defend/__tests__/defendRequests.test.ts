import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DefendOptionUse } from '../defendRecords.js';

// Setup loads these modules before a hoisted mock could apply.
const applyCondition = vi.fn();
const giveBack = vi.fn();
vi.resetModules();
vi.doMock('../../actor/applyConditionToActor.js', () => ({ default: applyCondition }));
vi.doMock('../../cost/costLedger.js', () => ({ giveBack: giveBack }));
const { defendRefusal, requestDefend, requestDefendAllyUse, undoDefend } = await import(
	'../defendRequests.js'
);

const TOKEN = 'Scene.s.Token.pip';
const ogre = { uuid: 'Actor.ogre', name: 'Ogre' };
const pip = { uuid: 'Actor.pip', setFlag: vi.fn(), unsetFlag: vi.fn(), getFlag: vi.fn() };
const bram = { uuid: 'Actor.bram' };

type Globals = { fromUuidSync: ReturnType<typeof vi.fn>; game: Record<string, unknown> };

const SAVED_GLOBALS = ['game', 'fromUuidSync', 'ui'].map(
	(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
);

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

async function allyUseOnNewDefend() {
	await requestDefend(request());
	const [record] = card.system.defends as { id: string }[];
	return {
		messageId: 'm1',
		defendId: record?.id ?? '',
		use: { ...paidUse, actorUuid: 'Actor.bram', label: 'Exploit' },
		reminder: 'Exploit: an enemy Interposes.',
	};
}

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
		conditionsEndOnAttackerTurn: [],
		way: 'action' as const,
		wholeRound: false,
		...fields,
	};
}

beforeEach(() => {
	card = makeCard();
	applyCondition.mockReset();
	giveBack.mockReset();
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

afterEach(() => {
	for (const [key, descriptor] of SAVED_GLOBALS) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
});

describe('Defend options on the card', () => {
	it('writes the option effect on the Defend', async () => {
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
	});

	it('puts the option condition on the attacker', async () => {
		await requestDefend(request({ attackerConditions: ['blinded'] }));

		expect(applyCondition).toHaveBeenCalledWith(ogre, 'blinded', { sourceActor: pip });
	});

	it('ends a condition at the start of the attacker next turn when the option says so', async () => {
		await requestDefend(
			request({ attackerConditions: ['blinded'], conditionsEndOnAttackerTurn: ['blinded'] }),
		);

		expect(applyCondition).toHaveBeenCalledWith(ogre, 'blinded', {
			sourceActor: pip,
			duration: { rounds: 1 },
		});
	});

	describe('in a combat, the end counts from the attacker turn', () => {
		const ogreCombatant = { id: 'c-ogre', actorId: 'ogre', tokenId: 'ogre-token' };
		const pipCombatant = { id: 'c-pip', actorId: 'pip', tokenId: 'pip-token' };

		function combat(turns: unknown[], turn: number) {
			return {
				id: 'combat-1',
				started: true,
				round: 3,
				turn,
				turns,
				combatants: { find: (fn: (c: unknown) => boolean) => turns.find(fn) },
			};
		}

		async function blindOn(turns: unknown[], turn: number) {
			(globalThis as unknown as Globals).game.combat = combat(turns, turn);
			card.speaker = { actor: 'ogre', token: 'ogre-token' } as never;
			await requestDefend(
				request({ attackerConditions: ['blinded'], conditionsEndOnAttackerTurn: ['blinded'] }),
			);
			return applyCondition.mock.calls[0]?.[2];
		}

		it('on the attacker turn: one round from now', async () => {
			expect(await blindOn([ogreCombatant, pipCombatant], 0)).toMatchObject({
				duration: { rounds: 1 },
				start: { combat: 'combat-1', combatant: 'c-ogre', round: 3, turn: 0 },
			});
		});

		it('when the attacker has gone this round: one round from now', async () => {
			expect(await blindOn([ogreCombatant, pipCombatant], 1)).toMatchObject({
				start: { combatant: 'c-ogre', round: 3 },
			});
		});

		it('when the attacker is not in the turn order: at their next turn, when it comes', async () => {
			const combatants = [ogreCombatant, pipCombatant];
			(globalThis as unknown as Globals).game.combat = {
				...combat([pipCombatant], 0),
				combatants: { find: (fn: (c: unknown) => boolean) => combatants.find(fn) },
			};
			card.speaker = { actor: 'ogre', token: 'ogre-token' } as never;
			await requestDefend(
				request({ attackerConditions: ['blinded'], conditionsEndOnAttackerTurn: ['blinded'] }),
			);
			expect(applyCondition.mock.calls[0]?.[2]).toMatchObject({
				start: { combatant: 'c-ogre', round: 2 },
			});
		});

		it('when the attacker turn is still to come this round: at that turn', async () => {
			expect(await blindOn([pipCombatant, ogreCombatant], 0)).toMatchObject({
				start: { combatant: 'c-ogre', round: 2 },
			});
		});
	});

	it('gives back what each option paid on Undo', async () => {
		await requestDefend(request({ options: [paidUse] }));
		const [record] = card.system.defends as { id: string }[];

		await undoDefend('m1', record?.id ?? '');

		expect(giveBack).toHaveBeenCalledWith(pip, { cost: paidUse.cost, paid: paidUse.paid });
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

	it('adds an ally option with its reminder line', async () => {
		const ally = await allyUseOnNewDefend();

		expect(await requestDefendAllyUse(ally)).toBe(true);

		const [after] = card.system.defends as { options: unknown[]; reminders: string[] }[];
		expect(after?.options).toEqual([ally.use]);
		expect(after?.reminders).toEqual(['Exploit: an enemy Interposes.']);
		expect(giveBack).not.toHaveBeenCalled();
	});

	it('refuses the same ally option a second time and gives back what it paid', async () => {
		const ally = await allyUseOnNewDefend();
		await requestDefendAllyUse(ally);

		expect(await requestDefendAllyUse(ally)).toBe(false);

		const [after] = card.system.defends as { options: unknown[]; reminders: string[] }[];
		expect(after?.options).toEqual([ally.use]);
		expect(after?.reminders).toEqual(['Exploit: an enemy Interposes.']);
		expect(giveBack).toHaveBeenCalledTimes(1);
		expect(giveBack).toHaveBeenCalledWith(bram, { cost: ally.use.cost, paid: ally.use.paid });
	});

	it('gives back what a refused Defend paid', async () => {
		card.system.targets = [];

		expect(await requestDefend(request({ options: [paidUse] }))).toBe(false);

		expect(giveBack).toHaveBeenCalledWith(pip, { cost: paidUse.cost, paid: paidUse.paid });
	});

	it('keeps what a second Defend for the same hero paid: the first Defend holds it', async () => {
		await requestDefend(request());

		expect(await requestDefend(request({ options: [paidUse] }))).toBe(false);

		expect(giveBack).not.toHaveBeenCalled();
	});

	it('does not undo a Defend after its damage is applied', async () => {
		await requestDefend(request({ options: [paidUse] }));
		const [record] = card.system.defends as { id: string }[];
		card.system.damageAppliedTo = [TOKEN];

		await undoDefend('m1', record?.id ?? '');

		expect(giveBack).not.toHaveBeenCalled();
		expect(card.system.defends).toHaveLength(1);
	});
});

describe('defendRefusal', () => {
	type Card = Parameters<typeof defendRefusal>[0];

	function refusalCard(system: Record<string, unknown> = {}): Card {
		const refused = makeCard();
		Object.assign(refused.system, system);
		return refused as unknown as Card;
	}

	it('accepts a Defend for a target', () => {
		expect(defendRefusal(refusalCard(), request())).toBeNull();
	});

	it('refuses a token the attack does not hit', () => {
		expect(defendRefusal(refusalCard(), request({ tokenUuid: 'Scene.s.Token.bram' }))).toBe(
			'NIMBLE.chat.defend.refused.notTarget',
		);
	});

	it('refuses after the damage is applied', () => {
		const applied = refusalCard({ damageAppliedTo: [TOKEN] });

		expect(defendRefusal(applied, request())).toBe('NIMBLE.chat.defend.refused.applied');
	});

	it('refuses a second Defend for the same token', () => {
		const defended = refusalCard({
			defends: [{ id: 'd1', tokenUuid: TOKEN, actorUuid: 'Actor.pip', armor: 3 }],
		});

		expect(defendRefusal(defended, request())).toBe('NIMBLE.chat.defend.refused.already');
	});

	it('refuses when the card is gone', () => {
		expect(defendRefusal(null, request())).toBe('NIMBLE.chat.defend.refused.noCard');
	});

	it('refuses when the card takes no Defend', () => {
		expect(defendRefusal(refusalCard({ defends: undefined }), request())).toBe(
			'NIMBLE.chat.defend.refused.noCard',
		);
	});
});
