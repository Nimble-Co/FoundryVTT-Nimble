import { describe, expect, it } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../tests/fixtures/combat.js';
import {
	buildCharacterTurnRefillUpdate,
	getCombatantPendingActionDelta,
	getCombatantResetActions,
	isCombatantDying,
} from './combatantSystem.js';

function createDyingActor(dyingActionLimit?: number) {
	return Object.assign(createCombatActorFixture({ type: 'character', dyingActionLimit }), {
		statuses: new Set(['dying']),
	}) as Actor.Implementation;
}

describe('isCombatantDying', () => {
	it('is true when the combatant actor has the dying status', () => {
		const combatant = createCombatantFixture({ actor: createDyingActor() });
		expect(isCombatantDying(combatant)).toBe(true);
	});

	it('is false when the combatant actor is not dying', () => {
		const combatant = createCombatantFixture({
			actor: createCombatActorFixture({ type: 'character' }),
		});
		expect(isCombatantDying(combatant)).toBe(false);
	});

	it('is false when the combatant has no actor', () => {
		const combatant = createCombatantFixture({ actor: null });
		expect(isCombatantDying(combatant)).toBe(false);
	});
});

describe('getCombatantResetActions', () => {
	it('resets to the base max when not dying', () => {
		const combatant = createCombatantFixture({
			actionsMax: 3,
			actor: createCombatActorFixture({ type: 'character' }),
		});
		expect(getCombatantResetActions(combatant)).toBe(3);
	});

	it('resets to 1 when dying', () => {
		const combatant = createCombatantFixture({ actionsMax: 3, actor: createDyingActor() });
		expect(getCombatantResetActions(combatant)).toBe(1);
	});

	it('respects a raised dying action limit (e.g. Enduring Rage)', () => {
		const combatant = createCombatantFixture({ actionsMax: 3, actor: createDyingActor(2) });
		expect(getCombatantResetActions(combatant)).toBe(2);
	});

	it('never resets above the combatant base max even with a higher dying limit', () => {
		const combatant = createCombatantFixture({ actionsMax: 1, actor: createDyingActor(2) });
		expect(getCombatantResetActions(combatant)).toBe(1);
	});
});

describe('getCombatantPendingActionDelta', () => {
	it('reads the pending delta from a character combatant', () => {
		const combatant = createCombatantFixture({ type: 'character', actionsPendingDelta: 2 });
		expect(getCombatantPendingActionDelta(combatant)).toBe(2);
	});

	it('preserves negative pending deltas (action debt)', () => {
		const combatant = createCombatantFixture({ type: 'character', actionsPendingDelta: -3 });
		expect(getCombatantPendingActionDelta(combatant)).toBe(-3);
	});

	it('is always 0 for non-character combatants', () => {
		const combatant = createCombatantFixture({ type: 'npc', actionsPendingDelta: 2 });
		expect(getCombatantPendingActionDelta(combatant)).toBe(0);
	});

	it('is 0 when the field is absent', () => {
		const combatant = {
			type: 'character',
			system: { actions: {} },
		} as unknown as Combatant.Implementation;
		expect(getCombatantPendingActionDelta(combatant)).toBe(0);
	});
});

describe('buildCharacterTurnRefillUpdate', () => {
	const HEROIC_AVAILABILITY_PATHS = [
		'system.actions.heroic.defendAvailable',
		'system.actions.heroic.interposeAvailable',
		'system.actions.heroic.opportunityAttackAvailable',
		'system.actions.heroic.helpAvailable',
	];

	it('refills to the base max when no pending delta exists', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsMax: 3,
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const update = buildCharacterTurnRefillUpdate(combatant);

		expect(update['system.actions.base.current']).toBe(3);
		expect(update['system.actions.base.additional']).toBe(0);
		expect(update['system.actions.pendingDelta']).toBe(0);
		for (const path of HEROIC_AVAILABILITY_PATHS) {
			expect(update[path]).toBe(true);
		}
	});

	it('folds a positive pending grant into the refill and zeroes it', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsMax: 3,
			actionsPendingDelta: 2,
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const update = buildCharacterTurnRefillUpdate(combatant);

		expect(update['system.actions.base.current']).toBe(5);
		expect(update['system.actions.pendingDelta']).toBe(0);
	});

	it('folds a negative pending debt into the refill, clamping at 0', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsMax: 3,
			actionsPendingDelta: -5,
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const update = buildCharacterTurnRefillUpdate(combatant);

		expect(update['system.actions.base.current']).toBe(0);
		expect(update['system.actions.pendingDelta']).toBe(0);
	});

	it('applies the pending delta on top of the Dying-capped reset', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actionsMax: 3,
			actionsPendingDelta: 1,
			actor: createDyingActor(),
		});
		const update = buildCharacterTurnRefillUpdate(combatant);

		// Dying caps the reset at 1; the pending grant still lands on top.
		expect(update['system.actions.base.current']).toBe(2);
		expect(update['system.actions.pendingDelta']).toBe(0);
	});
});
