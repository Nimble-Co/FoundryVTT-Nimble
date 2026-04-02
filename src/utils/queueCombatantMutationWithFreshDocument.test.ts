import { describe, expect, it, vi } from 'vitest';
import { createCombatantsCollectionFixture } from '../../tests/fixtures/combat.js';
import { createMockCombatant } from '../../tests/mocks/combat.js';
import { queueCombatantMutationWithFreshDocument } from './queueCombatantMutationWithFreshDocument.js';

function createCombatFixture(params: {
	combatId: string;
	combatants: Combatant.Implementation[];
}): Combat {
	return {
		id: params.combatId,
		combatants: createCombatantsCollectionFixture(params.combatants),
	} as unknown as Combat;
}

describe('queueCombatantMutationWithFreshDocument', () => {
	it('invokes the mutation with the fresh combatant document', async () => {
		const combatant = createMockCombatant({ id: 'combatant-a' });
		const combat = createCombatFixture({
			combatId: 'combat-with-fresh-combatant',
			combatants: [combatant],
		});
		const mutation = vi.fn(async () => 'changed');

		const result = await queueCombatantMutationWithFreshDocument({
			combat,
			combatantId: 'combatant-a',
			mutation,
		});

		expect(result).toBe('changed');
		expect(mutation).toHaveBeenCalledWith(combatant);
	});

	it('returns undefined when the combatant no longer exists', async () => {
		const combat = createCombatFixture({
			combatId: 'combat-without-combatant',
			combatants: [],
		});
		const mutation = vi.fn(async () => 'changed');

		const result = await queueCombatantMutationWithFreshDocument({
			combat,
			combatantId: 'missing-combatant',
			mutation,
		});

		expect(result).toBeUndefined();
		expect(mutation).not.toHaveBeenCalled();
	});
});
