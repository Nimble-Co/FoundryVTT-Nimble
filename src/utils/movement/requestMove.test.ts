import { describe, expect, it, vi } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import { PLAN_MOVE_QUERY, requestMove, selectMovingUser } from './requestMove.js';

const offer: MovementOffer = {
	id: 'offer-1',
	tokenUuid: 'Scene.s.Token.t',
	kind: 'forced',
	spaces: 2,
	ignoreDifficultTerrain: true,
	direction: 'away',
	chooser: 'source',
	label: 'Heavy Strike',
	messageId: null,
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

function makeToken(ownerIds: string[]) {
	return {
		actor: {
			testUserPermission: (user: { id: string }) => ownerIds.includes(user.id),
		},
	};
}

describe('selectMovingUser', () => {
	it('prefers an active player who owns the actor', () => {
		const player = makeUser({ id: 'p1' });
		const gm = makeUser({ id: 'gm', isGM: true });
		expect(selectMovingUser(makeToken(['p1']), [gm, player], gm)).toBe(player);
	});

	it('skips inactive owners and falls back to the active GM', () => {
		const player = makeUser({ id: 'p1', active: false });
		const gm = makeUser({ id: 'gm', isGM: true });
		expect(selectMovingUser(makeToken(['p1']), [player, gm], gm)).toBe(gm);
	});

	it('is null when nobody connected can move the token', () => {
		const gm = makeUser({ id: 'gm', isGM: true, active: false });
		expect(selectMovingUser(makeToken([]), [gm], gm)).toBeNull();
	});
});

describe('requestMove', () => {
	it('plans locally when this user is the mover', async () => {
		const me = makeUser({ id: 'p1', isSelf: true });
		const planLocally = vi
			.fn()
			.mockResolvedValue({ outcome: 'declined', movedSpaces: null, stopped: false });
		const result = await requestMove(offer, {
			resolveToken: () => makeToken(['p1']),
			users: [me],
			activeGm: null,
			planLocally,
		});
		expect(result.outcome).toBe('declined');
		expect(planLocally).toHaveBeenCalledWith(offer);
		expect(me.query).not.toHaveBeenCalled();
	});

	it('queries the owning client with the offer otherwise', async () => {
		const player = makeUser({ id: 'p1' });
		const planLocally = vi.fn();
		const result = await requestMove(offer, {
			resolveToken: () => makeToken(['p1']),
			users: [player],
			activeGm: null,
			planLocally,
		});
		expect(result).toEqual({ outcome: 'started', movedSpaces: 2, stopped: false });
		expect(player.query).toHaveBeenCalledWith(PLAN_MOVE_QUERY, offer, expect.any(Object));
		expect(planLocally).not.toHaveBeenCalled();
	});

	it('is unavailable when the query fails or times out', async () => {
		const player = makeUser({ id: 'p1' });
		player.query.mockRejectedValue(new Error('User has disconnected'));
		const result = await requestMove(offer, {
			resolveToken: () => makeToken(['p1']),
			users: [player],
			activeGm: null,
		});
		expect(result.outcome).toBe('unavailable');
	});

	it('is unavailable when the token cannot be resolved', async () => {
		expect((await requestMove(offer, { resolveToken: () => null })).outcome).toBe('unavailable');
	});
});
