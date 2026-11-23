import { describe, expect, it } from 'vitest';
import { resolveWouldDropToZero, type WouldDropPlan } from '../wouldDropToZero.js';

function drop(plan: WouldDropPlan, extra: Record<string, unknown> = {}) {
	return {
		type: 'wouldDropToZero',
		choice: 'automatic',
		watch: 'self',
		priority: 1,
		label: 'Feature',
		appliesTo: () => true,
		matchesDrop: () => true,
		planDrop: () => plan,
		...extra,
	};
}

function hero(rules: unknown[] = []) {
	return { uuid: 'Actor.Hero', name: 'Hero', rules };
}

describe('resolveWouldDropToZero', () => {
	it('lands the drop when nothing changes it', async () => {
		expect(await resolveWouldDropToZero({ actor: hero() })).toEqual({
			response: 'land',
			woundInstead: 0,
			moves: [],
		});
	});

	it('stops the drop, and can move the creature instead', async () => {
		const actor = hero([
			drop(
				{ response: 'prevent', woundInstead: 0, moveDistance: 6 },
				{ label: "Ha! I'm Over Here!" },
			),
		]);

		const outcome = await resolveWouldDropToZero({ actor });

		expect(outcome.response).toBe('prevent');
		expect(outcome.woundInstead).toBe(0);
		expect(outcome.moves).toEqual([
			{
				actorUuid: actor.uuid,
				distance: 6,
				name: "Ha! I'm Over Here!",
				direction: 'any',
			},
		]);
	});

	it('leaves the creature at 1 HP and names a separate Wound', async () => {
		const actor = hero([drop({ response: 'floor', woundInstead: 1, moveDistance: 0 })]);

		expect(await resolveWouldDropToZero({ actor })).toMatchObject({
			response: 'floor',
			woundInstead: 1,
		});
	});

	it('uses the first automatic rule and does not ask after it', async () => {
		const asked = { value: false };
		const actor = hero([
			drop({ response: 'prevent', woundInstead: 0, moveDistance: 0 }, { priority: 1 }),
			drop(
				{ response: 'floor', woundInstead: 3, moveDistance: 0 },
				{ priority: 2, choice: 'offer' },
			),
		]);

		const outcome = await resolveWouldDropToZero({
			actor,
			choose: async () => {
				asked.value = true;
				return true;
			},
		});

		expect(outcome.response).toBe('prevent');
		expect(asked.value).toBe(false);
	});

	it('lets the drop happen when the player declines', async () => {
		const actor = hero([
			drop({ response: 'prevent', woundInstead: 0, moveDistance: 0 }, { choice: 'offer' }),
		]);

		expect(await resolveWouldDropToZero({ actor, choose: async () => false })).toMatchObject({
			response: 'land',
		});
	});

	it('lets an ally stop the drop', async () => {
		const actor = hero();
		const companion = hero([
			drop({ response: 'prevent', woundInstead: 0, moveDistance: 0 }, { watch: 'allies' }),
		]);
		companion.uuid = 'Actor.Companion';

		expect(await resolveWouldDropToZero({ actor, watchers: [companion] })).toMatchObject({
			response: 'prevent',
		});
	});
});
