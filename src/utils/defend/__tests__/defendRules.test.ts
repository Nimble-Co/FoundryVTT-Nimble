import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS_EFFECT_IDS } from '../../../config/registerConditionsConfig.js';
import { attackCannotBeDefended, defendReactors } from '../defendReactors.js';
import { type DefendRequest, defendRefusal } from '../defendRequests.js';

const PIP_TOKEN = 'Scene.s.Token.pip';
const BRAM_TOKEN = 'Scene.s.Token.bram';
const OGRE_TOKEN = 'Scene.s.Token.ogre';

const pip = { uuid: 'Actor.pip', id: 'pip', type: 'character', name: 'Pip' };
const bram = { uuid: 'Actor.bram', id: 'bram', type: 'character', name: 'Bram' };
const ogre = { uuid: 'Actor.ogre', id: 'ogre', type: 'npc', name: 'Ogre' };

const documents: Record<string, unknown> = {
	[PIP_TOKEN]: { id: 'pip-token', actor: pip },
	[BRAM_TOKEN]: { id: 'bram-token', actor: bram },
	[OGRE_TOKEN]: { id: 'ogre-token', actor: ogre },
	'Actor.pip': pip,
	'Actor.bram': bram,
};

type Globals = { fromUuidSync: ReturnType<typeof vi.fn>; game: Record<string, unknown> };

function globals() {
	return globalThis as unknown as Globals;
}

function defendRecord(tokenUuid: string) {
	return { id: 'd1', tokenUuid, actorUuid: 'Actor.pip', armor: 3 };
}

function interpose(id: string, targetTokenUuid: string, actorUuid = 'Actor.bram') {
	return {
		id,
		kind: 'redirectToSelf',
		used: false,
		actorUuid,
		tokenUuid: BRAM_TOKEN,
		targetTokenUuid,
	};
}

function card(system: Record<string, unknown>, speaker: Record<string, unknown> | null = null) {
	return {
		system: { targets: [PIP_TOKEN], isMiss: false, defends: [], damageAppliedTo: [], ...system },
		speaker,
	};
}

function request(tokenUuid = PIP_TOKEN): DefendRequest {
	return {
		messageId: 'm1',
		tokenUuid,
		actorUuid: 'Actor.pip',
		armor: 3,
		label: '',
		combatantId: 'c1',
		previousActions: 3,
		reactionKeys: ['defend'],
		outcome: 'none',
		armorBonus: 0,
		options: [],
		reminders: [],
		attackerConditions: [],
		way: 'action',
		wholeRound: false,
	};
}

beforeEach(() => {
	globals().fromUuidSync = vi.fn((uuid: string) => documents[uuid] ?? null);
});

describe('defendReactors', () => {
	it('lists a hero the attack hits, and not a monster', () => {
		const reactors = defendReactors(card({ targets: [PIP_TOKEN, OGRE_TOKEN] }));

		expect(reactors.map((reactor) => reactor.actor.name)).toEqual(['Pip']);
		expect(reactors[0]?.targetTokenUuid).toBe(PIP_TOKEN);
	});

	it('lists nobody on a miss, or on a card that cannot take a Defend', () => {
		expect(defendReactors(card({ isMiss: true }))).toEqual([]);
		expect(defendReactors(card({ defends: undefined }))).toEqual([]);
		expect(defendReactors(card({ totalDamage: 0 }))).toEqual([]);
		expect(defendReactors(card({ totalDamage: 6 }))).toHaveLength(1);
	});

	it('drops a hero whose damage is applied, unless they Defended', () => {
		expect(defendReactors(card({ damageAppliedTo: [PIP_TOKEN] }))).toEqual([]);

		const reactors = defendReactors(
			card({ damageAppliedTo: [PIP_TOKEN], defends: [defendRecord(PIP_TOKEN)] }),
		);
		expect(reactors[0]?.defend?.armor).toBe(3);
	});

	it('lists an ally who can Interpose for a target, but not for someone the attack misses', () => {
		const reactors = defendReactors(
			card({
				incomingReactions: [interpose('i1', PIP_TOKEN), interpose('i2', OGRE_TOKEN)],
			}),
		);

		const bramReactor = reactors.find((reactor) => reactor.actor.name === 'Bram');
		expect(bramReactor?.targetTokenUuid).toBeNull();
		expect(bramReactor?.interposes.map((entry) => entry.id)).toEqual(['i1']);
	});

	it('drops a used Interpose', () => {
		const used = { ...interpose('i1', PIP_TOKEN), used: true };
		const reactors = defendReactors(card({ incomingReactions: [used] }));

		expect(reactors.map((reactor) => reactor.actor.name)).toEqual(['Pip']);
	});
});

describe('attackCannotBeDefended', () => {
	it('is true when the attacker is Latched', () => {
		const latched = { statuses: new Set([STATUS_EFFECT_IDS.latched]) };
		globals().game.actors = { get: vi.fn(() => latched) };

		expect(attackCannotBeDefended(card({}, { actor: 'stirge' }))).toBe(true);
	});

	it('is false for any other attacker', () => {
		globals().game.actors = { get: vi.fn(() => ({ statuses: new Set() })) };

		expect(attackCannotBeDefended(card({}, { actor: 'ogre' }))).toBe(false);
	});
});

describe('defendRefusal', () => {
	type Card = Parameters<typeof defendRefusal>[0];

	it('accepts a Defend for a target', () => {
		expect(defendRefusal(card({}) as unknown as Card, request())).toBeNull();
	});

	it('refuses a token the attack does not hit', () => {
		expect(defendRefusal(card({}) as unknown as Card, request(BRAM_TOKEN))).toBe(
			'NIMBLE.chat.defend.refused.notTarget',
		);
	});

	it('refuses after the damage is applied', () => {
		const applied = card({ damageAppliedTo: [PIP_TOKEN] }) as unknown as Card;

		expect(defendRefusal(applied, request())).toBe('NIMBLE.chat.defend.refused.applied');
	});

	it('refuses a second Defend for the same token', () => {
		const defended = card({ defends: [defendRecord(PIP_TOKEN)] }) as unknown as Card;

		expect(defendRefusal(defended, request())).toBe('NIMBLE.chat.defend.refused.already');
	});

	it('refuses when the card is gone or takes no Defend', () => {
		expect(defendRefusal(null, request())).toBe('NIMBLE.chat.defend.refused.noCard');
		expect(defendRefusal(card({ defends: undefined }) as unknown as Card, request())).toBe(
			'NIMBLE.chat.defend.refused.noCard',
		);
	});
});
