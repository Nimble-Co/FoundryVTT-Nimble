import { describe, expect, it } from 'vitest';
import { applyCharacterInitiativeActionUpdate } from './combatInitiative.js';

function createCharacter() {
	return { type: 'character' } as unknown as Combatant.Implementation;
}

describe('applyCharacterInitiativeActionUpdate', () => {
	it('sets both current and max to 3 for an initiative roll of 20 or more', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 22);

		expect(updates['system.actions.base.current']).toBe(3);
		expect(updates['system.actions.base.max']).toBe(3);
	});

	it('sets both current and max to 2 for an initiative roll between 10 and 19', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 14);

		expect(updates['system.actions.base.current']).toBe(2);
		expect(updates['system.actions.base.max']).toBe(2);
	});

	it('sets both current and max to 1 for an initiative roll below 10', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 7);

		expect(updates['system.actions.base.current']).toBe(1);
		expect(updates['system.actions.base.max']).toBe(1);
	});

	it('leaves the boundary roll of exactly 20 at 3 actions', () => {
		const updates: Record<string, unknown> = {};
		applyCharacterInitiativeActionUpdate(createCharacter(), updates, 20);

		expect(updates['system.actions.base.current']).toBe(3);
		expect(updates['system.actions.base.max']).toBe(3);
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
