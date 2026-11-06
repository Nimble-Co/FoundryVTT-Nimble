import { beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const near = new Set<string>();
const pay = vi.fn();
const requestAllyUse = vi.fn(async () => true);
vi.resetModules();
vi.doMock('../../tokens/tokenAdjacency.js', () => ({
	areAllies: () => true,
	areWithinSpaces: (a: { id: string }, b: { id: string }) => near.has(`${a.id}-${b.id}`),
}));
vi.doMock('../defendRequests.js', () => ({ requestDefendAllyUse: requestAllyUse }));
vi.doMock('../defendOptions.js', () => ({
	defendOptionsOf: (actor: { rules: unknown[] }) =>
		actor.rules.map((rule) => ({
			key: `Item.exploit:${(rule as { id: string }).id}`,
			label: 'Exploit',
			rule,
		})),
	payDefendOption: pay,
}));
const { allyDefendOffers, useAllyDefendOffer } = await import('../allyDefendOffers.js');

const PIP = 'Scene.s.Token.pip';
const exploit = { id: 'ex', resolveRange: () => 4, reminder: 'Force an enemy to Interpose.' };

function token(id: string, actorUuid: string, owner = true, rules: unknown[] = []) {
	return {
		id,
		document: { name: id },
		actor: { uuid: actorUuid, isOwner: owner, rules },
	};
}

const pip = token('pip', 'Actor.pip');
const bram = token('bram', 'Actor.bram', true, [exploit]);
const wren = token('wren', 'Actor.wren', true, [exploit]);
const ogre = token('ogre', 'Actor.ogre', false, [exploit]);

type Globals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: Record<string, unknown>;
	canvas: unknown;
};

function card(fields: Record<string, unknown> = {}) {
	return {
		system: {
			defends: [{ id: 'd1', tokenUuid: PIP, actorUuid: 'Actor.pip', options: [] }],
			damageAppliedTo: [],
			...fields,
		},
	};
}

beforeEach(() => {
	near.clear();
	near.add('bram-pip');
	pay.mockReset();
	requestAllyUse.mockClear();
	const globals = globalThis as unknown as Globals;
	globals.fromUuidSync = vi.fn((uuid: string) => (uuid === PIP ? { object: pip } : null));
	globals.canvas = { tokens: { placeables: [pip, bram, wren, ogre] } };
	globals.game = {
		user: { id: 'u1', isGM: false },
		users: { activeGM: { id: 'gm', isGM: true, active: true }, contents: [] },
		i18n: { localize: (key: string) => key, format: (key: string) => key },
	};
});

describe('allyDefendOffers', () => {
	it('offers the option of an owned ally within range of the hero who Defended', () => {
		const offers = allyDefendOffers(card());
		expect(offers.map((offer) => offer.actor.uuid)).toEqual(['Actor.bram']);
		expect(offers[0]).toMatchObject({ defendId: 'd1', defenderName: 'pip' });
	});

	it('offers nothing once the ally used it on this Defend', () => {
		const used = card({
			defends: [
				{
					id: 'd1',
					tokenUuid: PIP,
					actorUuid: 'Actor.pip',
					options: [{ actorUuid: 'Actor.bram', ruleId: 'ex' }],
				},
			],
		});
		expect(allyDefendOffers(used)).toEqual([]);
	});

	it('offers nothing after the damage is applied to the hero', () => {
		expect(allyDefendOffers(card({ damageAppliedTo: [PIP] }))).toEqual([]);
	});
});

describe('useAllyDefendOffer', () => {
	it('pays, then puts the use and its reminder line on the Defend', async () => {
		const use = { actorUuid: 'Actor.bram', ruleId: 'ex', label: 'Exploit' };
		pay.mockResolvedValue(use);
		const [offer] = allyDefendOffers(card());

		await useAllyDefendOffer('m1', offer as never);

		expect(requestAllyUse).toHaveBeenCalledWith({
			messageId: 'm1',
			defendId: 'd1',
			use,
			reminder: 'Exploit: Force an enemy to Interpose.',
		});
	});

	it('pays nothing when no GM is online to write it', async () => {
		(globalThis as unknown as Globals).game.users = { activeGM: null, contents: [] };
		const [offer] = allyDefendOffers(card());

		expect(await useAllyDefendOffer('m1', offer as never)).toBe(false);
		expect(pay).not.toHaveBeenCalled();
	});
});
