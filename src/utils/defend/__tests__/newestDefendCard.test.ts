import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newestDefendCard } from '../newestDefendCard.js';

const PIP_TOKEN = 'Scene.s.Token.pip';
const BRAM_TOKEN = 'Scene.s.Token.bram';

const pip = { uuid: 'Actor.pip', id: 'pip', type: 'character', name: 'Pip' };
const bram = { uuid: 'Actor.bram', id: 'bram', type: 'character', name: 'Bram' };

const documents: Record<string, unknown> = {
	[PIP_TOKEN]: { id: 'pip-token', actor: pip },
	[BRAM_TOKEN]: { id: 'bram-token', actor: bram },
	'Actor.pip': pip,
	'Actor.bram': bram,
};

function card(id: string, timestamp: number, system: Record<string, unknown> = {}) {
	return {
		id,
		timestamp,
		speaker: null,
		system: { targets: [PIP_TOKEN], isMiss: false, defends: [], damageAppliedTo: [], ...system },
	};
}

const interposeForPip = {
	id: 'i1',
	kind: 'redirectToSelf',
	used: false,
	actorUuid: 'Actor.bram',
	tokenUuid: BRAM_TOKEN,
	targetTokenUuid: PIP_TOKEN,
};

const hero = (actor: typeof pip) => actor as unknown as Actor.Implementation;

const SAVED_GLOBALS = ['fromUuidSync'].map(
	(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
);

beforeEach(() => {
	(globalThis as unknown as { fromUuidSync: unknown }).fromUuidSync = vi.fn(
		(uuid: string) => documents[uuid] ?? null,
	);
});

afterEach(() => {
	for (const [key, descriptor] of SAVED_GLOBALS) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
});

describe('newestDefendCard', () => {
	it('finds the newest card that attacks the hero', () => {
		const cards = [card('old', 10), card('new', 20)];

		expect(newestDefendCard(cards, hero(pip), 'defend', 0)?.id).toBe('new');
	});

	it('skips a card the hero already Defended, or whose damage is applied', () => {
		const defended = card('defended', 30, {
			defends: [{ id: 'd1', tokenUuid: PIP_TOKEN, actorUuid: 'Actor.pip', armor: 2 }],
		});
		const applied = card('applied', 20, { damageAppliedTo: [PIP_TOKEN] });
		const cards = [card('open', 10), applied, defended];

		expect(newestDefendCard(cards, hero(pip), 'defend', 0)?.id).toBe('open');
	});

	it('finds no card made before the combat', () => {
		expect(newestDefendCard([card('before', 5)], hero(pip), 'defend', 10)).toBeNull();
	});

	it('finds an Interpose only on a card where the hero has one', () => {
		const cards = [card('with', 10, { incomingReactions: [interposeForPip] }), card('without', 20)];

		expect(newestDefendCard(cards, hero(bram), 'interpose', 0)?.id).toBe('with');
		expect(newestDefendCard(cards, hero(bram), 'both', 0)?.id).toBe('with');
	});

	it('finds no card to Defend for a hero the attacks do not hit', () => {
		const cards = [card('with', 10, { incomingReactions: [interposeForPip] }), card('without', 20)];

		expect(newestDefendCard(cards, hero(bram), 'defend', 0)).toBeNull();
	});
});
