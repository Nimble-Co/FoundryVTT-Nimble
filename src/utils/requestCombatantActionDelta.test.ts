import { describe, expect, it } from 'vitest';
import { createCombatantFixture } from '../../tests/fixtures/combat.js';
import { buildCombatantActionDeltaUpdate } from './requestCombatantActionDelta.js';

describe('buildCombatantActionDeltaUpdate', () => {
	it('applies an immediate grant, allowing overflow past the pool max', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsCurrent: 3,
			actionsMax: 3,
		});
		const update = buildCombatantActionDeltaUpdate(combatant, {
			currentDelta: 2,
			pendingDelta: 0,
		});

		expect(update).toEqual({ 'system.actions.base.current': 5 });
	});

	it('clamps an immediate removal at 0', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsCurrent: 1,
			actionsMax: 3,
		});
		const update = buildCombatantActionDeltaUpdate(combatant, {
			currentDelta: -4,
			pendingDelta: 0,
		});

		expect(update).toEqual({ 'system.actions.base.current': 0 });
	});

	it('accumulates a pending grant onto the stored pending delta', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsPendingDelta: 1,
		});
		const update = buildCombatantActionDeltaUpdate(combatant, {
			currentDelta: 0,
			pendingDelta: 2,
		});

		expect(update).toEqual({ 'system.actions.pendingDelta': 3 });
	});

	it('writes a paired gain-now/owe-next-turn adjustment as one atomic update', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsCurrent: 1,
			actionsMax: 3,
			actionsPendingDelta: 0,
		});
		const update = buildCombatantActionDeltaUpdate(combatant, {
			currentDelta: 2,
			pendingDelta: -2,
		});

		expect(update).toEqual({
			'system.actions.base.current': 3,
			'system.actions.pendingDelta': -2,
		});
	});

	it('is null for non-character combatants', () => {
		const combatant = createCombatantFixture({ type: 'npc', actionsCurrent: 1 });
		expect(buildCombatantActionDeltaUpdate(combatant, { currentDelta: 2, pendingDelta: 0 })).toBe(
			null,
		);
	});

	it('is null for an all-zero adjustment', () => {
		const combatant = createCombatantFixture({ type: 'character' });
		expect(buildCombatantActionDeltaUpdate(combatant, { currentDelta: 0, pendingDelta: 0 })).toBe(
			null,
		);
	});

	it('normalizes non-finite deltas to no-ops', () => {
		const combatant = createCombatantFixture({ type: 'character' });
		expect(
			buildCombatantActionDeltaUpdate(combatant, {
				currentDelta: Number.NaN,
				pendingDelta: Number.POSITIVE_INFINITY,
			}),
		).toBe(null);
	});
});
