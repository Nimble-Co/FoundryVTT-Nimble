import { describe, expect, it } from 'vitest';
import { combatantActionMutationQueue } from './combatantActionMutationQueue.js';

function createCombatFixture(id: string): Combat {
	return { id } as unknown as Combat;
}

describe('combatantActionMutationQueue', () => {
	it('serializes mutations for the same combatant', async () => {
		const combat = createCombatFixture('combat-serialization');
		const events: string[] = [];
		let releaseFirstMutation: () => void = () => undefined;
		const firstMutationBlocker = new Promise<void>((resolve) => {
			releaseFirstMutation = resolve;
		});

		const firstMutation = combatantActionMutationQueue.queue({
			combat,
			combatantId: 'combatant-a',
			mutation: async () => {
				events.push('start:first');
				await firstMutationBlocker;
				events.push('end:first');
				return 'first';
			},
		});

		const secondMutation = combatantActionMutationQueue.queue({
			combat,
			combatantId: 'combatant-a',
			mutation: async () => {
				events.push('start:second');
				events.push('end:second');
				return 'second';
			},
		});

		releaseFirstMutation();
		await expect(firstMutation).resolves.toBe('first');
		await expect(secondMutation).resolves.toBe('second');
		expect(events).toEqual(['start:first', 'end:first', 'start:second', 'end:second']);
	});

	it('clears pending mutations for a deleted combat', async () => {
		const combat = createCombatFixture('combat-delete');
		let releaseBlockedMutation: () => void = () => undefined;
		const blockedMutation = new Promise<void>((resolve) => {
			releaseBlockedMutation = resolve;
		});

		const mutationPromise = combatantActionMutationQueue.queue({
			combat,
			combatantId: 'combatant-a',
			mutation: async () => {
				await blockedMutation;
				return 'done';
			},
		});

		await Promise.resolve();
		combatantActionMutationQueue.clearForCombat('combat-delete');

		await expect(
			combatantActionMutationQueue.waitForCombatant({
				combat: createCombatFixture('combat-delete'),
				combatantId: 'combatant-a',
			}),
		).resolves.toBeUndefined();

		releaseBlockedMutation();
		await expect(mutationPromise).resolves.toBe('done');
	});
});
