import { beforeEach, describe, expect, it } from 'vitest';
import { cardAttackers } from '../cardAttackers.js';

const globals = globalThis as unknown as { [key: string]: any };

const bow = { system: { activation: { targets: { attackType: 'range' } } } };
const stab = { system: { activation: { targets: { attackType: '' } } } };
const member = (id: string, disposition: number) => ({
	actor: {
		uuid: `Actor.${id}`,
		type: 'minion',
		items: {
			get: (itemId: string) => (itemId === 'bow' ? bow : itemId === 'stab' ? stab : undefined),
		},
	},
	token: { disposition },
});

beforeEach(() => {
	const combatants = new Map([
		['c1', member('g1', -1)],
		['c2', member('g2', -1)],
	]);
	globals.game.combats = [{ combatants }];
	globals.game.scenes = { get: () => ({ tokens: { get: () => ({ disposition: -1 }) } }) };
});

describe('cardAttackers', () => {
	it('gives each member of a minion group, a missed one too, with the delivery of its action', () => {
		const card = {
			type: 'minionGroupAttack',
			system: {
				rows: [
					{ memberCombatantId: 'c1', actionId: 'stab', isMiss: true },
					{ memberCombatantId: 'c2', actionId: 'bow' },
				],
			},
		};

		const attackers = cardAttackers(card, null, null);
		expect(attackers.map((each) => each.hit)).toEqual([false, true]);

		expect(attackers.map((each) => [(each.actor as { uuid: string }).uuid, each.delivery])).toEqual(
			[
				['Actor.g1', 'melee'],
				['Actor.g2', 'ranged'],
			],
		);
	});

	it('gives the speaker of another card, with its token and the card delivery', () => {
		const speaker = { uuid: 'Actor.ogre' };
		const card = { type: 'feature', speaker: { scene: 's', token: 't' } };

		expect(cardAttackers(card, speaker, 'melee')).toEqual([
			{ actor: speaker, token: { disposition: -1 }, delivery: 'melee' },
		]);
		expect(cardAttackers(card, null, 'melee')).toEqual([]);
	});
});
