import { beforeEach, describe, expect, it, vi } from 'vitest';

import SpendDicePoolDialog, {
	type SpendDicePoolDialogResult,
} from './SpendDicePoolDialog.svelte.js';

function makeActor(): Actor {
	return {
		name: 'Aragorn',
		id: 'actor-1',
	} as unknown as Actor;
}

describe('SpendDicePoolDialog — constructor wiring', () => {
	beforeEach(() => {
		// SvelteApplicationMixin calls super.close() which routes through the
		// ApplicationV2 base. Stub the base close so submit/close don't try to
		// drive a real ApplicationV2 lifecycle.
		(
			foundry.applications.api.ApplicationV2.prototype as unknown as {
				close: ReturnType<typeof vi.fn>;
			}
		).close = vi.fn().mockResolvedValue(undefined);
	});

	it('stores the actor and poolId passed to the constructor', () => {
		const actor = makeActor();
		const dialog = new SpendDicePoolDialog(actor, 'judgment');

		expect(dialog.actor).toBe(actor);
		expect(dialog.poolId).toBe('judgment');
	});

	it('exposes a promise that resolves when submitSpend is called with the result', async () => {
		const dialog = new SpendDicePoolDialog(makeActor(), 'judgment');

		const result: SpendDicePoolDialogResult = {
			spentFaces: [4, 6],
			presetItemId: 'item-1',
			presetRuleId: 'rule-1',
			effectTotal: 10,
		};

		await dialog.submitSpend(result);

		await expect(dialog.promise).resolves.toEqual(result);
	});

	it('resolves the promise with null when close() is called without a prior submit', async () => {
		const dialog = new SpendDicePoolDialog(makeActor(), 'judgment');

		await dialog.close();

		await expect(dialog.promise).resolves.toBeNull();
	});
});
