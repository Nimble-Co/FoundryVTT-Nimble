import { describe, expect, it, vi } from 'vitest';
import type { MovementOffer, MovementOfferRef } from '#types/movement.js';
import type { CardMovementOffer } from './buildCardMovementOffer.js';
import { PLAN_MOVE_QUERY, requestMove, selectMovingUser } from './requestMove.js';

const ref: MovementOfferRef = {
	messageId: 'msg-1',
	nodeId: 'node-1',
	tokenUuid: 'Scene.s.Token.t',
};

const offer: MovementOffer = {
	id: 'msg-1.node-1.t',
	tokenUuid: 'Scene.s.Token.t',
	kind: 'forced',
	spaces: 2,
	ignoreDifficultTerrain: true,
	direction: 'away',
	chooser: 'source',
	label: 'Heavy Strike',
	messageId: 'msg-1',
};

function makeUser(overrides: { id: string; active?: boolean; isGM?: boolean; isSelf?: boolean }) {
	return {
		active: true,
		isGM: false,
		isSelf: false,
		query: vi.fn().mockResolvedValue({ outcome: 'started', movedSpaces: 2, stopped: false }),
		...overrides,
	};
}

function makeCard(ownerIds: string[]): CardMovementOffer {
	return {
		offer,
		token: {
			id: 't',
			uuid: offer.tokenUuid,
			name: 'Goblin',
			actor: {
				getRollData: () => ({}),
				testUserPermission: (user: unknown) => ownerIds.includes((user as { id: string }).id),
			},
		},
	} as unknown as CardMovementOffer;
}

describe('selectMovingUser', () => {
	it('prefers this user when they own the actor', () => {
		const me = makeUser({ id: 'me', isSelf: true });
		const player = makeUser({ id: 'p1' });
		const gm = makeUser({ id: 'gm', isGM: true });
		expect(selectMovingUser(makeCard(['me', 'p1']), me, [gm, player, me], gm)).toBe(me);
	});

	it('otherwise picks an active player who owns the actor', () => {
		const me = makeUser({ id: 'me', isSelf: true });
		const player = makeUser({ id: 'p1' });
		const gm = makeUser({ id: 'gm', isGM: true });
		expect(selectMovingUser(makeCard(['p1']), me, [gm, player], gm)).toBe(player);
	});

	it('skips inactive owners and falls back to the active GM', () => {
		const player = makeUser({ id: 'p1', active: false });
		const gm = makeUser({ id: 'gm', isGM: true });
		expect(selectMovingUser(makeCard(['p1']), null, [player, gm], gm)).toBe(gm);
	});

	it('is null when nobody connected can move the token', () => {
		const gm = makeUser({ id: 'gm', isGM: true, active: false });
		expect(selectMovingUser(makeCard([]), null, [gm], gm)).toBeNull();
	});
});

describe('requestMove', () => {
	it('plans locally when this user is the mover', async () => {
		const me = makeUser({ id: 'me', isSelf: true });
		const planLocally = vi
			.fn()
			.mockResolvedValue({ outcome: 'declined', movedSpaces: null, stopped: false });
		const result = await requestMove(ref, {
			resolveCard: () => makeCard(['me']),
			self: me,
			users: [me],
			activeGm: null,
			planLocally,
		});
		expect(result.outcome).toBe('declined');
		expect(planLocally).toHaveBeenCalledWith(offer);
		expect(me.query).not.toHaveBeenCalled();
	});

	it('queries the owning client with only the card, node and token ids', async () => {
		const player = makeUser({ id: 'p1' });
		const planLocally = vi.fn();
		const result = await requestMove(ref, {
			resolveCard: () => makeCard(['p1']),
			self: null,
			users: [player],
			activeGm: null,
			planLocally,
		});
		expect(result).toEqual({ outcome: 'started', movedSpaces: 2, stopped: false });
		expect(player.query).toHaveBeenCalledWith(PLAN_MOVE_QUERY, ref, expect.any(Object));
		expect(planLocally).not.toHaveBeenCalled();
	});

	it('is unavailable when the query fails, times out or answers nonsense', async () => {
		const player = makeUser({ id: 'p1' });
		const deps = {
			resolveCard: () => makeCard(['p1']),
			self: null,
			users: [player],
			activeGm: null,
		};
		player.query.mockRejectedValueOnce(new Error('User has disconnected'));
		expect((await requestMove(ref, deps)).outcome).toBe('unavailable');
		player.query.mockResolvedValueOnce({ outcome: 'teleported' });
		expect((await requestMove(ref, deps)).outcome).toBe('unavailable');
	});

	it('is unavailable when the card has no such offer', async () => {
		expect((await requestMove(ref, { resolveCard: () => null })).outcome).toBe('unavailable');
	});
});
