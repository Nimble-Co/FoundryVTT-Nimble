import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildCardMovementOffer = vi.hoisted(() => vi.fn());
const canUserTakeMovementOffer = vi.hoisted(() => vi.fn());
const getPrimaryActiveGmId = vi.hoisted(() => vi.fn(() => 'gm'));
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
const card = { offer: { id: 'm.n.t', spaces: 2 } };

type GameStub = {
	user: { id: string; isGM: boolean };
	users: { get: (id: string) => unknown };
	messages: { get: (id: string) => unknown };
	socket: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };
};
const g = globalThis as unknown as { game: GameStub };
const previous = { ...g.game };

let update: ReturnType<typeof vi.fn>;
let listener: ((payload: unknown) => void) | null;

beforeEach(() => {
	update = vi.fn().mockResolvedValue(undefined);
	listener = null;
	g.game = {
		...previous,
		user: { id: 'gm', isGM: true },
		users: { get: (id: string) => ({ id, isGM: id === 'gm' }) },
		messages: { get: () => ({ system: { movementOffers: [] }, update }) },
		socket: {
			on: vi.fn((_name: string, fn: (payload: unknown) => void) => {
				listener = fn;
			}),
			emit: vi.fn(),
		},
	} as GameStub;
	buildCardMovementOffer.mockReturnValue(card);
	canUserTakeMovementOffer.mockReturnValue(true);
});

afterAll(() => {
	g.game = previous as GameStub;
});

describe('requestMovementOfferStamp', () => {
	it('stamps the entry rebuilt from the card as GM, keeping only the drag result from the request', async () => {
		await requestMovementOfferStamp(ref, { movedSpaces: 7.9, stopped: true });
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
						movedSpaces: 7,
						stopped: true,
					},
				],
			},
		});
	});

	it('relays the ids and the result to the GM as a player', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await requestMovementOfferStamp(ref, { movedSpaces: 1, stopped: false });
		expect(update).not.toHaveBeenCalled();
		expect(g.game.socket.emit).toHaveBeenCalledWith(
			'system.nimble',
			expect.objectContaining({ ref, stamp: { movedSpaces: 1, stopped: false }, userId: 'p1' }),
		);
	});
});

describe('relayed stamp requests', () => {
	function relay(overrides: Record<string, unknown> = {}) {
		registerMovementOfferSocketListener();
		listener?.({
			type: 'movementOffer.stamp',
			ref,
			stamp: { movedSpaces: 1, stopped: false },
			userId: 'p1',
			...overrides,
		});
		return new Promise((resolve) => setTimeout(resolve, 0));
	}

	it('writes a stamp from a player who may take the offer', async () => {
		await relay();
		expect(update).toHaveBeenCalledTimes(1);
		expect(canUserTakeMovementOffer).toHaveBeenCalledWith({ id: 'p1', isGM: false }, card);
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

	it('ignores requests that carry no usable ids', async () => {
		await relay({ ref: { messageId: 'm' } });
		expect(update).not.toHaveBeenCalled();
	});
});
