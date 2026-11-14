import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

// Setup loads the cost module before a hoisted mock could apply.
const canPay = vi.fn(() => true);
vi.resetModules();
vi.doMock('../../cost/useCost.js', () => ({
	canPayUseCost: canPay,
}));
vi.doMock('../../cost/costLedger.js', () => ({ payCost: vi.fn() }));
const { defendOptionEffect, defendOptionsOf, tickCost } = await import('../defendOptions.js');

const ITEM_EFFECTS = {
	sand: { name: 'Pocket Sand', transfer: false },
	aura: { name: 'Aura', transfer: true },
};

function rule(fields: Record<string, unknown> = {}) {
	return {
		id: String(fields.id ?? 'r1'),
		type: 'defendOption',
		label: '',
		parentDocument: {
			uuid: String(fields.itemUuid ?? 'Item.feature'),
			name: String(fields.name ?? 'Feature'),
			getDomain: () => new Set(),
			effects: new Map(Object.entries(ITEM_EFFECTS)),
		},
		way: 'withDefend',
		attackDelivery: 'any',
		outcome: 'none',
		reminder: '',
		attackerEffectId: '',
		wholeRound: false,
		useItem: false,
		optionCost: {},
		appliesTo: () => fields.applies !== false,
		resolveArmorBonus: () => Number(fields.bonus ?? 0),
		...fields,
	};
}

type DefendRules = Parameters<typeof defendOptionEffect>[0];

function card(attackType: string | null) {
	return { system: { activation: { targets: { attackType } } } };
}

describe('defendOptionEffect', () => {
	it('picks a miss over halve and armor only', () => {
		const effect = defendOptionEffect([
			rule({ outcome: 'halve' }),
			rule({ outcome: 'miss' }),
			rule({ outcome: 'none' }),
		] as unknown as DefendRules);
		expect(effect.outcome).toBe('miss');
	});

	it('picks halve over armor only', () => {
		const effect = defendOptionEffect([
			rule({ outcome: 'none' }),
			rule({ outcome: 'halve' }),
		] as unknown as DefendRules);
		expect(effect.outcome).toBe('halve');
	});

	it('picks armor only with no options', () => {
		expect(defendOptionEffect([]).outcome).toBe('none');
	});

	it('adds the armor of every option and keeps each reminder and attacker effect once', () => {
		const effect = defendOptionEffect([
			rule({
				name: 'Decoy',
				bonus: 2,
				reminder: 'Move half your speed.',
				attackerEffectId: 'sand',
			}),
			rule({ name: 'Mana Infusion', bonus: 4, attackerEffectId: 'sand', wholeRound: true }),
		] as unknown as DefendRules);
		expect(effect.armorBonus).toBe(6);
		expect(effect.reminders).toEqual(['Decoy: Move half your speed.']);
		expect(effect.attackerEffects).toEqual([
			{ itemUuid: 'Item.feature', effectId: 'sand', name: 'Pocket Sand' },
		]);
		expect(effect.wholeRound).toBe(true);
	});

	it('keeps the same effect id of two items apart', () => {
		const effect = defendOptionEffect([
			rule({ attackerEffectId: 'sand' }),
			rule({ itemUuid: 'Item.other', attackerEffectId: 'sand' }),
		] as unknown as DefendRules);
		expect(effect.attackerEffects.map((each) => each.itemUuid)).toEqual([
			'Item.feature',
			'Item.other',
		]);
	});

	it('puts nothing on the attacker with no pick, a lost effect, or an effect applied to the actor', () => {
		const effect = defendOptionEffect([
			rule({}),
			rule({ attackerEffectId: 'gone' }),
			rule({ attackerEffectId: 'aura' }),
		] as unknown as DefendRules);
		expect(effect.attackerEffects).toEqual([]);
	});
});

describe('defendOptionsOf', () => {
	const game = (globalThis as unknown as { game: Record<string, unknown> }).game;
	const actorsBefore = game.actors;
	beforeEach(() => {
		canPay.mockReturnValue(true);
	});
	afterEach(() => {
		game.actors = actorsBefore;
	});

	it('lists the options of one way that fit the attack', () => {
		const actor = {
			rules: [
				rule({ id: 'melee', attackDelivery: 'melee' }),
				rule({ id: 'ranged', attackDelivery: 'ranged' }),
				rule({ id: 'free', way: 'freeDefend' }),
				rule({ id: 'off', applies: false }),
				{ id: 'other', type: 'reroll' },
			],
		};
		const ids = (attackType: string | null) =>
			defendOptionsOf(actor as never, card(attackType), 'withDefend').map((pick) => pick.rule.id);
		expect(ids('reach')).toEqual(['melee']);
		expect(ids('range')).toEqual(['ranged']);
	});

	it('treats a monster attack with no attack type as melee', () => {
		const actor = {
			rules: [
				rule({ id: 'melee', attackDelivery: 'melee' }),
				rule({ id: 'ranged', attackDelivery: 'ranged' }),
			],
		};
		game.actors = new Map([
			['goblin', { type: 'npc' }],
			['hero', { type: 'character' }],
		]) as never;
		const ids = (actorId: string) =>
			defendOptionsOf(
				actor as never,
				{ speaker: { actor: actorId }, system: { activation: { targets: { attackType: '' } } } },
				'withDefend',
			).map((pick) => pick.rule.id);
		expect(ids('goblin')).toEqual(['melee']);
		expect(ids('hero')).toEqual([]);
	});

	it('offers no melee or ranged option against a monster area attack with no attack type', () => {
		const actor = {
			rules: [
				rule({ id: 'melee', attackDelivery: 'melee' }),
				rule({ id: 'any', attackDelivery: 'any' }),
			],
		};
		game.actors = new Map([['dragon', { type: 'soloMonster' }]]) as never;
		const breath = {
			speaker: { actor: 'dragon' },
			system: {
				activation: {
					targets: { attackType: '' },
					acquireTargetsFromTemplate: true,
					template: { shape: 'cone' },
				},
			},
		};
		const ids = defendOptionsOf(actor as never, breath, 'withDefend').map((pick) => pick.rule.id);
		expect(ids).toEqual(['any']);
	});

	it('leaves out an option the hero cannot pay for, unless it uses its item', () => {
		canPay.mockReturnValue(false);
		const actor = { rules: [rule({ id: 'paid' }), rule({ id: 'spell', useItem: true })] };
		const picks = defendOptionsOf(actor as never, card('reach'), 'withDefend');
		expect(picks.map((pick) => pick.rule.id)).toEqual(['spell']);
		expect(picks[0]?.label).toBe('Feature');
	});

	it('lists an option for the other creature only when the attacker is that creature', () => {
		const ogre = { uuid: 'Actor.ogre', getTargetDomain: () => new Set<string>() };
		const goblin = { uuid: 'Actor.goblin', getTargetDomain: () => new Set<string>() };
		const hunter = {
			getDomain: () => new Set<string>(),
			getFlag: (scope: string, key: string) =>
				scope === SYSTEM_ID && key === 'toggledEffects'
					? { quarry: [{ actorUuid: 'Actor.ogre', tokenUuid: null, name: 'Ogre' }] }
					: undefined,
			rules: [] as unknown[],
		};
		hunter.rules = [
			rule({
				id: 'peerless',
				way: 'freeDefend',
				actor: hunter,
				parentDocument: { uuid: 'Item.peerless', name: 'Peerless Hunter' },
				parentDomain: new Set(),
				otherCreature: { $and: ['target:quarry'] },
			}),
		];
		game.actors = new Map([
			['ogre', ogre],
			['goblin', goblin],
		]);
		const attackBy = (actorId: string) => ({
			speaker: { actor: actorId },
			system: { activation: { targets: { attackType: 'reach' } } },
		});
		const ids = (actorId: string) =>
			defendOptionsOf(hunter as never, attackBy(actorId), 'freeDefend').map((pick) => pick.rule.id);

		expect(ids('ogre')).toEqual(['peerless']);
		expect(ids('goblin')).toEqual([]);
	});

	it("checks a reroll tick against its item's Reroll cost, not the option's", () => {
		const rerollCost = { manaCost: 1 };
		const fearsome = rule({
			id: 'fearsome',
			useReroll: true,
			optionCost: { manaCost: 0 },
			parentDocument: {
				uuid: 'Item.beast',
				getDomain: () => new Set(),
				rules: new Map([['r', { type: 'reroll', rolls: ['attack'], rollUseCost: rerollCost }]]),
			},
		});
		canPay.mockImplementation(((_actor: unknown, cost: unknown) => cost !== rerollCost) as never);

		expect(defendOptionsOf({ rules: [fearsome] } as never, card('reach'), 'withDefend')).toEqual(
			[],
		);
	});
});

describe('tickCost', () => {
	const saveCost = { manaCost: 2 };
	const attackCost = { manaCost: 1 };
	const fearsome = () =>
		rule({
			id: 'fearsome',
			useReroll: true,
			optionCost: { manaCost: 0 },
			parentDocument: {
				uuid: 'Item.beast',
				getDomain: () => new Set(),
				rules: new Map([
					['save', { type: 'reroll', id: 'save', rolls: ['save'], rollUseCost: saveCost }],
					['fear', { type: 'reroll', id: 'fear', rolls: ['attack'], rollUseCost: attackCost }],
				]),
			},
		});

	it('takes the cost of the Reroll rule that the card entry names', () => {
		const attack = {
			system: {
				incomingReactions: [
					{ kind: 'reroll', used: false, itemUuid: 'Item.beast', ruleId: 'fear' },
				],
			},
		};
		expect(tickCost(fearsome() as never, attack)).toBe(attackCost);
	});

	it('takes the cost of a Reroll rule for attacks when the card has no entry yet', () => {
		expect(tickCost(fearsome() as never)).toBe(attackCost);
	});
});
