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
	moved = 3,
} = {}) {
	const planMovement = vi.fn().mockResolvedValue(plan);
	const startMovement = vi.fn().mockResolvedValue(started);
	const waypoints = Array.from({ length: moved }, (_, i) => ({
		x: (i + 1) * 100,
		y: 0,
		action: 'walk',
		movementId: 'plan-1',
	}));
	const token = {
		isOwner,
		parent: { grid: { distance: 5, isGridless: false } },
		object: { planMovement },
		startMovement,
		actor: null,
		movementHistory: [],
		combatant: null,
		movement: {
			id: 'plan-1',
			chain: [],
			state: started ? 'completed' : 'stopped',
			constrained: !started,
			origin: { x: 0, y: 0 },
			passed: { waypoints },
			history: { recorded: { waypoints: [] }, unrecorded: { waypoints: [] } },
			user: { id: 'u1' },
		},
		measureMovementPath(points: { x: number }[]) {
			const segments: { distance: number; spaces: number }[] = [];
			for (let i = 1; i < points.length; i++) segments.push({ distance: 5, spaces: 1 });
			return { segments };
		},
		getCompleteMovementPath(points: object[]) {
			return points;
		},
	};
	return { token, planMovement, startMovement };
}

describe('planOfferedMove', () => {
	it('caps a free move that honours terrain by cost', async () => {
		const { token, planMovement, startMovement } = makeToken();
		const result = await planOfferedMove(makeOffer(), () => token);
		expect(result).toEqual({ outcome: 'started', movedSpaces: 3, stopped: false });
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

	it('plans a directed push as one straight drag with the forced action', async () => {
		const { token, planMovement } = makeToken();
		await planOfferedMove(makeOffer({ kind: 'forced', spaces: 2, direction: 'away' }), () => token);
		expect(planMovement.mock.calls[0][0]).toMatchObject({
			allowedActions: [FORCED_MOVEMENT_ACTION],
			direct: true,
			maxDistance: 10,
			constrainOptions: { ignoreCost: true },
		});
	});

	it('lets a push in any direction bend', async () => {
		const { token, planMovement } = makeToken();
		await planOfferedMove(makeOffer({ kind: 'forced', direction: 'any' }), () => token);
		expect(planMovement.mock.calls[0][0]).toMatchObject({ direct: false });
	});

	it('passes nothing but the plan constraints to core', async () => {
		const { token, planMovement } = makeToken();
		await planOfferedMove(makeOffer(), () => token);
		expect(planMovement.mock.calls[0][0]).not.toHaveProperty('moveOptions');
	});

	it('is unavailable when core refuses to plan on this client', async () => {
		const { token, planMovement } = makeToken();
		planMovement.mockRejectedValue(new Error('hidden token'));
		expect((await planOfferedMove(makeOffer(), () => token)).outcome).toBe('unavailable');
	});

	it('is unavailable without a placed token or a scene grid', async () => {
		const { token } = makeToken();
		expect((await planOfferedMove(makeOffer(), () => ({ ...token, object: null }))).outcome).toBe(
			'unavailable',
		);
		expect((await planOfferedMove(makeOffer(), () => ({ ...token, parent: null }))).outcome).toBe(
			'unavailable',
		);
	});

	it('is declined when the movement that ran belongs to another plan', async () => {
		const { token } = makeToken();
		token.movement.id = 'someone-elses';
		expect((await planOfferedMove(makeOffer(), () => token)).outcome).toBe('declined');
	});

	it('is declined when the owner dismisses the plan', async () => {
		const { token, startMovement } = makeToken({ plan: null });
		expect((await planOfferedMove(makeOffer(), () => token)).outcome).toBe('declined');
		expect(startMovement).not.toHaveBeenCalled();
	});

	it('is unavailable when this client does not own the token', async () => {
		const { token, planMovement } = makeToken({ isOwner: false });
		expect((await planOfferedMove(makeOffer(), () => token)).outcome).toBe('unavailable');
		expect(planMovement).not.toHaveBeenCalled();
	});

	it('reports a drag a wall cut short with the spaces it did cover', async () => {
		const { token } = makeToken({ started: false, moved: 1 });
		expect(await planOfferedMove(makeOffer({ kind: 'forced' }), () => token)).toEqual({
			outcome: 'started',
			movedSpaces: 1,
			stopped: true,
		});
	});

	it('is declined when the drop moved nothing', async () => {
		const { token } = makeToken({ moved: 0 });
		expect((await planOfferedMove(makeOffer(), () => token)).outcome).toBe('declined');
	});
});
