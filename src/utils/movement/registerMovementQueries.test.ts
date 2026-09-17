import { describe, expect, it, vi } from 'vitest';
import type { CardMovementOffer } from './buildCardMovementOffer.js';
import { handlePlanMoveQuery } from './registerMovementQueries.js';

const ref = { messageId: 'm', nodeId: 'n', tokenUuid: 'Scene.s.Token.t' };
const user = { id: 'p1', isGM: false };
const card = { offer: { id: 'm.n.t' }, entry: null } as unknown as CardMovementOffer;

function makeDeps(overrides: Partial<Parameters<typeof handlePlanMoveQuery>[2]> = {}) {
	return {
		resolveCard: vi.fn(() => card),
		canTake: vi.fn(() => true),
		plan: vi.fn().mockResolvedValue({ outcome: 'started', movedSpaces: 2, stopped: false }),
		...overrides,
	};
}

describe('handlePlanMoveQuery', () => {
	it('plans the offer rebuilt from the card for a user who may take it', async () => {
		const deps = makeDeps();
		expect(await handlePlanMoveQuery(ref, { user }, deps)).toEqual({
			outcome: 'started',
			movedSpaces: 2,
			stopped: false,
		});
		expect(deps.resolveCard).toHaveBeenCalledWith(ref);
		expect(deps.canTake).toHaveBeenCalledWith(user, card);
		expect(deps.plan).toHaveBeenCalledWith(card.offer);
	});

	it('refuses an offer the card already records as taken', async () => {
		const taken = { ...card, entry: { used: true } } as unknown as CardMovementOffer;
		const deps = makeDeps({ resolveCard: vi.fn(() => taken) });
		expect((await handlePlanMoveQuery(ref, { user }, deps)).outcome).toBe('unavailable');
		expect(deps.plan).not.toHaveBeenCalled();
	});

	it('refuses a user who may not take the offer', async () => {
		const deps = makeDeps({ canTake: vi.fn(() => false) });
		expect((await handlePlanMoveQuery(ref, { user }, deps)).outcome).toBe('unavailable');
		expect(deps.plan).not.toHaveBeenCalled();
	});

	it('refuses a malformed request or a card without that offer', async () => {
		const deps = makeDeps();
		expect((await handlePlanMoveQuery({ spaces: 99 }, { user }, deps)).outcome).toBe('unavailable');
		expect(deps.resolveCard).not.toHaveBeenCalled();
		const missing = makeDeps({ resolveCard: vi.fn(() => null) });
		expect((await handlePlanMoveQuery(ref, { user }, missing)).outcome).toBe('unavailable');
		expect(missing.plan).not.toHaveBeenCalled();
	});
});
