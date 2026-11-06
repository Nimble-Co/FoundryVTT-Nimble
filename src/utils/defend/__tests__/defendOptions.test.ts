import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

// Setup loads the cost module before a hoisted mock could apply.
const canPay = vi.fn(() => true);
vi.resetModules();
vi.doMock('../../reroll/rerollCost.js', () => ({
	canPayRerollCost: canPay,
	payRerollCost: vi.fn(),
}));
const { defendOptionEffect, defendOptionsOf } = await import('../defendOptions.js');

function rule(fields: Record<string, unknown> = {}) {
	return {
		id: String(fields.id ?? 'r1'),
		type: 'defendOption',
		label: '',
		item: {
			uuid: 'Item.feature',
			name: String(fields.name ?? 'Feature'),
			getDomain: () => new Set(),
		},
		way: 'withDefend',
		attackDelivery: 'any',
		outcome: 'none',
		reminder: '',
		attackerCondition: '',
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
	it('uses the fixed order: a miss wins over halve, and halve over armor only', () => {
		const effect = defendOptionEffect([
			rule({ outcome: 'halve' }),
			rule({ outcome: 'miss' }),
			rule({ outcome: 'none' }),
		] as unknown as DefendRules);
		expect(effect.outcome).toBe('miss');
		expect(defendOptionEffect([rule({ outcome: 'halve' })] as unknown as DefendRules).outcome).toBe(
			'halve',
		);
		expect(defendOptionEffect([]).outcome).toBe('none');
	});

	it('adds the armor of every option and keeps each reminder and condition once', () => {
		const effect = defendOptionEffect([
			rule({
				name: 'Decoy',
				bonus: 2,
				reminder: 'Move half your speed.',
				attackerCondition: 'blinded',
			}),
			rule({ name: 'Mana Infusion', bonus: 4, attackerCondition: 'blinded', wholeRound: true }),
		] as unknown as DefendRules);
		expect(effect.armorBonus).toBe(6);
		expect(effect.reminders).toEqual(['Decoy: Move half your speed.']);
		expect(effect.attackerConditions).toEqual(['blinded']);
		expect(effect.wholeRound).toBe(true);
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
				item: { uuid: 'Item.peerless', name: 'Peerless Hunter', getDomain: () => new Set() },
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
});
