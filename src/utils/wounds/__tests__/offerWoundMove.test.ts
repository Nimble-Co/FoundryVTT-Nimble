import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as findActorTokenModule from '#utils/movement/findActorToken.js';
import * as postMovementOfferCardModule from '#utils/movement/postMovementOfferCard.js';
import { offerWoundMove } from '../offerWoundMove.js';

const findToken = vi.spyOn(findActorTokenModule, 'findActorToken');
const postCard = vi.spyOn(postMovementOfferCardModule, 'postMovementOfferCard');

function actor(uuid: string, name: string) {
	return { uuid, name };
}

beforeEach(() => {
	findToken.mockReset();
	postCard.mockReset();
	postCard.mockResolvedValue({ id: 'card' } as never);
});

describe('offerWoundMove', () => {
	it('offers a move away from the attacker', async () => {
		findToken.mockImplementation((source) => {
			const uuid = (source as { uuid?: string } | null)?.uuid;
			if (!uuid) return null;
			return { uuid: `${uuid}.Token` } as TokenDocument;
		});
		const hunter = actor('Actor.Hunter', 'Hunter');
		const wolf = actor('Actor.Wolf', 'Wolf');

		const posted = await offerWoundMove(hunter, 6, "Ha! I'm Over Here!", {
			direction: 'away',
			origin: { actor: wolf as Actor, uuid: wolf.uuid, name: wolf.name },
		});

		expect(posted).toBe(true);
		expect(postCard).toHaveBeenCalledWith(
			expect.objectContaining({
				actor: wolf,
				recipients: ['Actor.Hunter.Token'],
				whisper: true,
				node: expect.objectContaining({
					kind: 'free',
					distance: '6',
					direction: 'away',
				}),
			}),
		);
	});

	it('offers any direction when the attacker has no token', async () => {
		findToken.mockImplementation((source) => {
			const uuid = (source as { uuid?: string } | null)?.uuid;
			if (uuid !== 'Actor.Hunter') return null;
			return { uuid: 'Actor.Hunter.Token' } as TokenDocument;
		});
		const hunter = actor('Actor.Hunter', 'Hunter');

		const posted = await offerWoundMove(hunter, 6, "Ha! I'm Over Here!", {
			direction: 'away',
			origin: { uuid: 'Actor.Wolf', name: 'Wolf' },
		});

		expect(posted).toBe(true);
		expect(postCard).toHaveBeenCalledWith(
			expect.objectContaining({
				actor: hunter,
				recipients: 'self',
				node: expect.objectContaining({ direction: 'any', distance: '6' }),
			}),
		);
	});

	it('posts nothing when the creature who would move has no token', async () => {
		findToken.mockReturnValue(null);

		const posted = await offerWoundMove(actor('Actor.Hunter', 'Hunter'), 6, 'Move');

		expect(posted).toBe(false);
		expect(postCard).not.toHaveBeenCalled();
	});
});
