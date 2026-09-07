import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { createPlayerCharacterSettingsTabState } from './PlayerCharacterSettingsTabState.svelte.js';

function createActor() {
	return {
		update: vi.fn().mockResolvedValue(undefined),
		reactive: {
			flags: { [SYSTEM_ID]: {} },
			system: { inventory: { bonusSlots: 0 }, resources: { highestUnlockedSpellTier: 3 } },
		},
	};
}

describe('createPlayerCharacterSettingsTabState', () => {
	describe('resetHighestUnlockedSpellTier', () => {
		it('stores null so the tier is derived from spell grants again', async () => {
			const actor = createActor();
			const state = createPlayerCharacterSettingsTabState(
				() => actor,
				() => true,
			);

			await state.resetHighestUnlockedSpellTier();

			expect(actor.update).toHaveBeenCalledTimes(1);
			expect(actor.update).toHaveBeenCalledWith({
				'system.resources.highestUnlockedSpellTier': null,
			});
		});
	});
});
