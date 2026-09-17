import { describe, expect, it, vi } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';
import { planOfferedMove } from './planOfferedMove.js';

function makeOffer(overrides: Partial<MovementOffer> = {}): MovementOffer {
	return {
		id: 'offer-1',
		tokenUuid: 'Scene.s.Token.t',
		kind: 'free',
		spaces: 4,
		ignoreDifficultTerrain: false,
		direction: 'any',
		chooser: 'mover',
		label: 'Fleet Feet',
		messageId: 'msg-1',
		...overrides,
	};
}

function makeToken({
	isOwner = true,
	plan = { id: 'plan-1' } as { id: string } | null,
	started = true,
} = {}) {
	const planMovement = vi.fn().mockResolvedValue(plan);
	const startMovement = vi.fn().mockResolvedValue(started);
	return {
		token: { isOwner, parent: { grid: { distance: 5 } }, object: { planMovement }, startMovement },
		planMovement,
		startMovement,
	};
}

describe('planOfferedMove', () => {
	it('caps a free move that honours terrain by cost', async () => {
		const { token, planMovement, startMovement } = makeToken();
		const outcome = await planOfferedMove(makeOffer(), () => token);
		expect(outcome).toBe('started');
		expect(planMovement).toHaveBeenCalledWith(
			expect.objectContaining({
				allowedActions: [FREE_MOVEMENT_ACTION],
				direct: false,
				maxCost: 20,
			}),
		);
		expect(planMovement.mock.calls[0][0]).not.toHaveProperty('maxDistance');
		expect(startMovement).toHaveBeenCalledWith('plan-1');
	});

	it('caps a free move that ignores terrain by distance', async () => {
		const { token, planMovement } = makeToken();
		await planOfferedMove(makeOffer({ ignoreDifficultTerrain: true }), () => token);
		expect(planMovement.mock.calls[0][0]).toMatchObject({ maxDistance: 20 });
		expect(planMovement.mock.calls[0][0]).not.toHaveProperty('maxCost');
	});

	it('plans a forced move as a direct drag with the forced action', async () => {
		const { token, planMovement } = makeToken();
		await planOfferedMove(makeOffer({ kind: 'forced', spaces: 2 }), () => token);
		expect(planMovement.mock.calls[0][0]).toMatchObject({
			allowedActions: [FORCED_MOVEMENT_ACTION],
			direct: true,
			maxDistance: 10,
		});
	});

	it('tags the drop with the offer so every client can match the record', async () => {
		const { token, planMovement } = makeToken();
		await planOfferedMove(makeOffer(), () => token);
		const moveOptions = planMovement.mock.calls[0][0].moveOptions as Record<string, unknown>;
		expect(Object.values(moveOptions)[0]).toEqual({ offerId: 'offer-1', messageId: 'msg-1' });
	});

	it('is declined when the owner dismisses the plan', async () => {
		const { token, startMovement } = makeToken({ plan: null });
		expect(await planOfferedMove(makeOffer(), () => token)).toBe('declined');
		expect(startMovement).not.toHaveBeenCalled();
	});

	it('is unavailable when this client does not own the token', async () => {
		const { token, planMovement } = makeToken({ isOwner: false });
		expect(await planOfferedMove(makeOffer(), () => token)).toBe('unavailable');
		expect(planMovement).not.toHaveBeenCalled();
	});
});
