import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { effectCardOption } from '#utils/damage/damageCard.js';
import { answerAttackCard, answerAttackOfEffect } from '../damageBackOnAttack.js';

const globals = globalThis as unknown as { [key: string]: any };

class FakeActor {
	uuid = 'Actor.mira';
}

const mira = new FakeActor();
const miraToken = { uuid: 'Scene.s.Token.mira', actor: mira, disposition: 1 };
const sword = {
	uuid: 'Actor.goblin.Item.stab',
	actor: { uuid: 'Actor.goblin' },
	system: {},
};

function attackCard(overrides: { [key: string]: unknown } = {}) {
	return {
		id: 'attack-card',
		type: 'feature',
		flags: { [SYSTEM_ID]: { itemUuid: sword.uuid } },
		system: {
			targets: [miraToken.uuid],
			activation: { effects: [{ type: 'damage' }] },
		},
		cardDamageBack: { afterAttack: vi.fn(async () => undefined) },
		...overrides,
	};
}

let messages: Map<string, unknown>;

beforeEach(() => {
	globals.Actor = FakeActor;
	globals.game.user = { ...globals.game.user, id: 'gm', isGM: true };
	globals.game.users = { activeGM: { id: 'gm' } };
	messages = new Map();
	globals.game.messages = messages;
	globals.fromUuidSync = vi.fn((uuid: string) =>
		uuid === miraToken.uuid ? miraToken : uuid === sword.uuid ? sword : null,
	);
});

describe('an attack card', () => {
	it('gives the Attacked rules of each creature it attacks to its attackers', async () => {
		const card = attackCard();

		await answerAttackCard(card as never);

		expect(card.cardDamageBack.afterAttack).toHaveBeenCalledWith([
			{ actor: mira, token: miraToken },
		]);
	});

	it('is read only on the active GM', async () => {
		globals.game.users = { activeGM: { id: 'other-gm' } };
		const card = attackCard();

		await answerAttackCard(card as never);

		expect(card.cardDamageBack.afterAttack).not.toHaveBeenCalled();
	});

	it('is not an attack with no damage and no save', async () => {
		const card = attackCard({ system: { targets: [miraToken.uuid], activation: { effects: [] } } });

		await answerAttackCard(card as never);

		expect(card.cardDamageBack.afterAttack).not.toHaveBeenCalled();
	});
});

describe('an effect from a use that answers an attack', () => {
	const flameBarrier = { id: 'eFlame', parent: mira };

	it('covers the attack card that its use answers, for its own rules', async () => {
		const attack = attackCard();
		messages.set('attack-card', attack);
		messages.set('reaction-card', { flags: { [SYSTEM_ID]: { answersCardId: 'attack-card' } } });

		await answerAttackOfEffect(flameBarrier, effectCardOption('reaction-card'));

		expect(attack.cardDamageBack.afterAttack).toHaveBeenCalledWith(
			[{ actor: mira, token: miraToken }],
			{ effectId: 'eFlame' },
		);
	});

	it('covers no card when its use answers none', async () => {
		const attack = attackCard();
		messages.set('attack-card', attack);
		messages.set('reaction-card', { flags: { [SYSTEM_ID]: {} } });

		await answerAttackOfEffect(flameBarrier, effectCardOption('reaction-card'));
		await answerAttackOfEffect(flameBarrier, {});

		expect(attack.cardDamageBack.afterAttack).not.toHaveBeenCalled();
	});
});
