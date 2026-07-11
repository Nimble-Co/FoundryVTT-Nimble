import { describe, expect, it } from 'vitest';
import { applyCharacterInitiativeActionUpdate } from './combatInitiative.js';

function createCharacter() {
	return { type: 'character' } as unknown as Combatant.Implementation;
}

describe('applyCharacterInitiativeActionUpdate', () => {
	// The initiative roll only seeds a character's starting actions for the first
	// round. `max` is always 3 (reduced only by Dying at restore time), so the
	// update must set `current` and never touch `max`.
	it('seeds current to 3 for an initiative roll of 20 or more without setting max', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 22);

		expect(updates['system.actions.base.current']).toBe(3);
		expect(updates['system.actions.base.max']).toBeUndefined();
	});

	it('seeds current to 2 for an initiative roll between 10 and 19 without setting max', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 14);

		expect(updates['system.actions.base.current']).toBe(2);
		expect(updates['system.actions.base.max']).toBeUndefined();
	});

	it('seeds current to 1 for an initiative roll below 10 without setting max', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 7);

		expect(updates['system.actions.base.current']).toBe(1);
		expect(updates['system.actions.base.max']).toBeUndefined();
	});

	it('treats the boundary roll of exactly 20 as 3 starting actions', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 20);

		expect(updates['system.actions.base.current']).toBe(3);
	});

	it('does not modify actions for non-character combatants', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(
			{ type: 'soloMonster' } as unknown as Combatant.Implementation,
			updates,
			22,
		);

		expect(updates['system.actions.base.current']).toBeUndefined();
		expect(updates['system.actions.base.max']).toBeUndefined();
	});
});
