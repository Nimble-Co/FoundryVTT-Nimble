import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const buildCardMovementOffer = vi.hoisted(() => vi.fn());
const canUserTakeMovementOffer = vi.hoisted(() => vi.fn());
const getPrimaryActiveGmId = vi.hoisted(() => vi.fn<() => string | null>(() => 'gm'));
vi.mock('./buildCardMovementOffer.js', () => ({
	buildCardMovementOffer,
	canUserTakeMovementOffer,
}));
vi.mock('../getPrimaryActiveGmId.js', () => ({ getPrimaryActiveGmId }));

import {
	registerMovementOfferSocketListener,
	requestMovementOfferStamp,
} from './movementOfferRelay.js';

const ref = { messageId: 'm', nodeId: 'n', tokenUuid: 'Scene.s.Token.t' };

function makeCard(entry: { used: boolean } | null = null) {
	return { offer: { id: 'm.n.t', spaces: 2 }, entry };
}

type GameStub = {
	user: { id: string; isGM: boolean };
	users: { get: (id: string) => unknown };
	messages: { get: (id: string) => unknown };
	socket: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };
};
const g = globalThis as unknown as { game: GameStub };
const previous = g.game;

let update: ReturnType<typeof vi.fn>;
// The listener registers once per module load, so the socket stub is shared
// by every test and the listener captured up front.
let listener: ((payload: unknown) => void) | null = null;
const socket = {
	on: vi.fn((_name: string, fn: (payload: unknown) => void) => {
		listener = fn;
	}),
	emit: vi.fn(),
};

beforeAll(() => {
	g.game = { ...previous, socket } as GameStub;
	registerMovementOfferSocketListener();
	registerMovementOfferSocketListener();
	expect(socket.on).toHaveBeenCalledTimes(1);
	expect(listener).not.toBeNull();
});

beforeEach(() => {
	update = vi.fn().mockResolvedValue(undefined);
	socket.emit.mockClear();
	g.game = {
		...previous,
		user: { id: 'gm', isGM: true },
		users: { get: (id: string) => ({ id, isGM: id === 'gm' }) },
		messages: { get: () => ({ system: { movementOffers: [] }, update }) },
		socket,
	} as GameStub;
	buildCardMovementOffer.mockReturnValue(makeCard());
	canUserTakeMovementOffer.mockReturnValue(true);
	getPrimaryActiveGmId.mockReturnValue('gm');
});

afterAll(() => {
	g.game = previous;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('requestMovementOfferStamp', () => {
	it('stamps the entry rebuilt from the card as GM, keeping only the drag result from the request', async () => {
		await requestMovementOfferStamp(ref, { movedSpaces: 1.9, stopped: true });
		expect(update).toHaveBeenCalledWith({
			system: {
				movementOffers: [
					{
						id: 'm.n.t',
						nodeId: 'n',
						tokenUuid: ref.tokenUuid,
						spaces: 2,
						used: true,
						usedBy: 'gm',
						movedSpaces: 1,
						stopped: true,
					},
				],
			},
		});
	});

	it('never records more spaces than the card offered', async () => {
		await requestMovementOfferStamp(ref, { movedSpaces: 9, stopped: false });
		expect(update.mock.calls[0][0].system.movementOffers[0].movedSpaces).toBe(2);
	});

	it('leaves an offer that was already taken alone', async () => {
		buildCardMovementOffer.mockReturnValue(makeCard({ used: true }));
		await requestMovementOfferStamp(ref, { movedSpaces: 2, stopped: false });
		expect(update).not.toHaveBeenCalled();
	});

	it('relays the ids and the result to the GM as a player', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await requestMovementOfferStamp(ref, { movedSpaces: 1, stopped: false });
		expect(update).not.toHaveBeenCalled();
		expect(socket.emit).toHaveBeenCalledWith(
			'system.nimble',
			expect.objectContaining({ ref, stamp: { movedSpaces: 1, stopped: false }, userId: 'p1' }),
		);
	});

	it('sends nothing when no GM is connected', async () => {
		g.game.user = { id: 'p1', isGM: false };
		getPrimaryActiveGmId.mockReturnValue(null);
		await requestMovementOfferStamp(ref, { movedSpaces: 1, stopped: false });
		expect(socket.emit).not.toHaveBeenCalled();
	});
});

describe('relayed stamp requests', () => {
	function relay(overrides: Record<string, unknown> = {}) {
		listener?.({
			type: 'movementOffer.stamp',
			ref,
			stamp: { movedSpaces: 1, stopped: false },
			userId: 'p1',
			...overrides,
		});
		return flush();
	}

	it('writes a stamp from a player who may take the offer', async () => {
		await relay();
		expect(update).toHaveBeenCalledTimes(1);
		expect(update.mock.calls[0][0].system.movementOffers[0]).toMatchObject({
			usedBy: 'p1',
			movedSpaces: 1,
		});
		expect(canUserTakeMovementOffer).toHaveBeenCalledWith({ id: 'p1', isGM: false }, makeCard());
	});

	it('ignores a player who may not take the offer', async () => {
		canUserTakeMovementOffer.mockReturnValue(false);
		await relay();
		expect(update).not.toHaveBeenCalled();
	});

	it('ignores a relayed request that claims to be the GM', async () => {
		await relay({ userId: 'gm' });
		expect(update).not.toHaveBeenCalled();
	});

	it('ignores requests that carry no usable ids or another type', async () => {
		await relay({ ref: { messageId: 'm' } });
		await relay({ type: 'grantedActionOffer' });
		expect(update).not.toHaveBeenCalled();
	});

	it('is handled by the primary GM only', async () => {
		getPrimaryActiveGmId.mockReturnValue('other-gm');
		await relay();
		expect(update).not.toHaveBeenCalled();
	});
});
