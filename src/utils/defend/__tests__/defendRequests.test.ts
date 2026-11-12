import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { DefendOptionUse } from '#types/defend.d.ts';
import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.js';

// Setup loads these modules before a hoisted mock could apply.
const applyEffectHere = vi.fn();
const giveBack = vi.fn();
vi.resetModules();
const applyEffect = await vi.importActual<typeof import('../../actor/applyEffectToActor.js')>(
	'../../actor/applyEffectToActor.js',
);
vi.doMock('../../actor/applyEffectToActor.js', () => ({ ...applyEffect, applyEffectHere }));
vi.doMock('../../cost/costLedger.js', () => ({ giveBack: giveBack }));
const { applyAttackerEffects, defendRefusal, requestDefend, requestDefendAllyUse, undoDefend } =
	await import('../defendRequests.js');

const TOKEN = 'Scene.s.Token.pip';
type TestEffect = { id: string; flags?: Record<string, Record<string, unknown>> };
const ogre = {
	uuid: 'Actor.ogre',
	name: 'Ogre',
	effects: [] as TestEffect[],
	deleteEmbeddedDocuments: vi.fn(),
};
const pip = {
	uuid: 'Actor.pip',
	effects: [] as TestEffect[],
	setFlag: vi.fn(),
	unsetFlag: vi.fn(),
	getFlag: vi.fn(),
	createEmbeddedDocuments: vi.fn(async (_type: string, data: Record<string, unknown>[]) => {
		const created = data.map((each, index) => ({ ...each, id: `made-${index}` }) as TestEffect);
		pip.effects.push(...created);
		return created;
	}),
	deleteEmbeddedDocuments: vi.fn(async (_type: string, ids: string[]) => {
		pip.effects = pip.effects.filter((effect) => !ids.includes(effect.id));
	}),
	getRollData: () => ({}),
};
const bram = { uuid: 'Actor.bram' };
const UNTIL_BLINDED_ENDS = [{ kind: 'turn', boundary: 'start', clock: 'holder', span: 'nextTurn' }];
const sandEffect = {
	transfer: false,
	toObject: () => ({
		_id: 'e-sand',
		name: 'Pocket Sand',
		statuses: ['blinded'],
		transfer: false,
		origin: null,
		system: { lastsUntil: UNTIL_BLINDED_ENDS },
	}),
};
const sandItem = { uuid: 'Item.sand', actor: pip, effects: new Map([['e-sand', sandEffect]]) };
const burstItem = { uuid: 'Item.burst', img: 'burst.webp' };
const SAND = { itemUuid: 'Item.sand', effectId: 'e-sand', name: 'Pocket Sand' };

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
		attackerEffects: [] as { itemUuid: string; effectId: string; name: string }[],
		way: 'action' as const,
		wholeRound: false,
		...fields,
	};
}

beforeEach(() => {
	card = makeCard();
	applyEffectHere.mockReset();
	giveBack.mockReset();
	ogre.effects = [];
	ogre.deleteEmbeddedDocuments.mockClear();
	pip.effects = [];
	pip.createEmbeddedDocuments.mockClear();
	pip.deleteEmbeddedDocuments.mockClear();
	const globals = globalThis as unknown as Globals;
	const documents: Record<string, unknown> = {
		'Actor.pip': pip,
		'Actor.bram': bram,
		'Item.sand': sandItem,
		'Item.burst': burstItem,
	};
	globals.fromUuidSync = vi.fn((uuid: string) => documents[uuid] ?? null);
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
				attackerEffects: [SAND],
			}),
		);

		const [record] = card.system.defends as Record<string, unknown>[];
		expect(record).toMatchObject({
			outcome: 'halve',
			armorBonus: 2,
			reminders: ['Pocket Sand: reroll.'],
			attackerEffects: [SAND],
		});
	});

	it('puts a copy of the item effect on the attacker, with the item as source', async () => {
		await requestDefend(request({ attackerEffects: [SAND] }));

		expect(applyEffectHere).toHaveBeenCalledTimes(1);
		const [target, payload] = applyEffectHere.mock.calls[0] ?? [];
		expect(target).toBe(ogre);
		expect(payload).toMatchObject({
			sourceItemUuid: 'Item.sand',
			sourceActorUuid: 'Actor.pip',
			data: {
				name: 'Pocket Sand',
				statuses: ['blinded'],
				system: { lastsUntil: UNTIL_BLINDED_ENDS },
			},
		});
		expect(payload.data).not.toHaveProperty('_id');
		expect(payload.data).not.toHaveProperty('transfer');
	});

	it('puts nothing on the attacker with no effect picked', async () => {
		await requestDefend(request());

		expect(applyEffectHere).not.toHaveBeenCalled();
	});

	it('puts nothing on the attacker when the item effect is gone', async () => {
		await requestDefend(request({ attackerEffects: [{ ...SAND, effectId: 'gone' }] }));

		expect(applyEffectHere).not.toHaveBeenCalled();
	});

	it('an Interpose with no Defend puts the item effect on the attacker by the given apply', async () => {
		const apply = vi.fn();

		await applyAttackerEffects(ogre as never, [SAND], 'Actor.pip', apply);

		expect(applyEffectHere).not.toHaveBeenCalled();
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply.mock.calls[0]?.[0]).toBe(ogre);
		expect(apply.mock.calls[0]?.[1]).toMatchObject({
			sourceItemUuid: 'Item.sand',
			data: { name: 'Pocket Sand' },
		});
	});

	it('does not take the attacker effect back on Undo', async () => {
		applyEffectHere.mockImplementation(async (target: typeof ogre) => {
			target.effects.push({ id: 'sand-copy' });
		});
		await requestDefend(request({ attackerEffects: [SAND] }));
		const [record] = card.system.defends as { id: string }[];

		await undoDefend('m1', record?.id ?? '');

		expect(card.system.defends).toEqual([]);
		expect(ogre.effects.map((effect) => effect.id)).toEqual(['sand-copy']);
		expect(ogre.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	describe('a Defend for the whole round', () => {
		const whirl: DefendOptionUse = {
			...paidUse,
			label: 'Whirling Defense',
			itemUuid: 'Item.burst',
		};

		beforeEach(() => {
			(globalThis as unknown as Globals).game.combat = {
				id: 'combat-1',
				started: true,
				round: 2,
				turn: 1,
				combatants: { get: () => undefined },
			};
		});

		async function defendWholeRound() {
			await requestDefend(
				request({
					label: 'Whirling Defense',
					armorBonus: 1,
					outcome: 'miss',
					options: [whirl],
					way: 'free',
					wholeRound: true,
				}),
			);
			return (card.system.defends as { id: string }[])[0]?.id ?? '';
		}

		it('is a Timed Effect on the hero until the start of their next turn, with the mark in its flags', async () => {
			const recordId = await defendWholeRound();

			expect(pip.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
				{
					name: 'Whirling Defense',
					img: 'burst.webp',
					type: NIMBLE_EFFECT_TYPE,
					origin: 'Item.burst',
					system: {
						lastsUntil: [
							{
								kind: 'turn',
								boundary: 'start',
								clock: 'holder',
								span: 'nextTurn',
								value: null,
								units: null,
								who: null,
								event: null,
								effectName: '',
							},
						],
					},
					flags: {
						[SYSTEM_ID]: {
							roundDefend: {
								combatId: 'combat-1',
								round: 2,
								turn: 1,
								label: 'Whirling Defense',
								armorBonus: 1,
								outcome: 'miss',
								messageId: 'm1',
								recordId,
							},
						},
					},
				},
			]);
		});

		it('makes no effect outside a combat', async () => {
			(globalThis as unknown as Globals).game.combat = null;

			await defendWholeRound();

			expect(pip.createEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('replaces an older whole-round effect of the hero', async () => {
			pip.effects = [{ id: 'old', flags: { [SYSTEM_ID]: { roundDefend: { recordId: 'r-old' } } } }];

			await defendWholeRound();

			expect(pip.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['old'], {
				[CONDITION_REPLACED_OPTION]: true,
			});
			expect(pip.effects.map((effect) => effect.id)).toEqual(['made-0']);
		});

		it('Undo deletes the effect of that Defend only, by its record id', async () => {
			const recordId = await defendWholeRound();
			pip.effects.push(
				{ id: 'other', flags: { [SYSTEM_ID]: { roundDefend: { recordId: 'r-other' } } } },
				{ id: 'plain' },
			);

			await undoDefend('m1', recordId);

			expect(pip.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['made-0']);
			expect(pip.effects.map((effect) => effect.id)).toEqual(['other', 'plain']);
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

	it('gives back the action an option paid on Undo in a later turn', async () => {
		const ledger = await vi.importActual<typeof import('../../cost/costLedger.js')>(
			'../../cost/costLedger.js',
		);
		giveBack.mockImplementation(ledger.giveBack);
		const hero = {
			id: 'c1',
			type: 'character',
			system: { actions: { base: { current: 1, max: 3 }, pendingDelta: 0 } },
			update: vi.fn(async (changes: Record<string, unknown>) => {
				for (const [path, value] of Object.entries(changes)) {
					foundry.utils.setProperty(hero, path, value);
				}
			}),
		};
		(globalThis as unknown as Globals).game.combat = {
			id: 'combat-1',
			round: 2,
			combatant: { id: 'c2' },
			combatants: { get: (id: string) => (id === 'c1' ? hero : undefined) },
		};
		const actionUse: DefendOptionUse = {
			...paidUse,
			cost: {
				chargePoolIdentifier: '',
				chargeCost: 0,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 1,
			},
			paid: {
				charges: 0,
				mana: 0,
				wounds: 0,
				heroicReaction: null,
				action: { combatId: 'combat-1', combatantId: 'c1', amount: 1, now: true },
				stamp: { combatId: 'combat-1', round: 1, combatantId: 'c1' },
			},
		};
		await requestDefend(request({ options: [actionUse] }));
		const [record] = card.system.defends as { id: string }[];

		await undoDefend('m1', record?.id ?? '');

		expect(hero.system.actions.base.current).toBe(2);
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
