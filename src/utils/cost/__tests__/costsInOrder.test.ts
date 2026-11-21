import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceCost } from '#types/resourceCost.d.ts';
import { spendResourceCosts } from '../costLedger.js';
import { resourceCostRefusal } from '../itemResourceCosts.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
};

function mana(amount: number, beyond: ResourceCost['beyond'] = 'notAllowed'): ResourceCost {
	return { kind: 'mana', amount, spend: { mode: 'fixed' }, beyond, source: 'Surge' };
}

function hero(current: number) {
	const actor = {
		system: { resources: { mana: { current, max: 10 } } },
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

describe('two costs of one kind on one use', () => {
	beforeEach(() => {
		testGlobals.game.settings = {
			get: (_scope, key) => key === 'automation.resourceSpending',
		};
	});
	afterEach(() => {
		testGlobals.game.settings = undefined;
	});

	it('refuses 3 and 3 mana of 5, and the notice states what is left', () => {
		expect(resourceCostRefusal(hero(5) as never, [mana(3), mana(3)])).toBe(
			'Surge needs 3 mana. You have 2.',
		);
	});

	it('allows 2 and 3 mana of 5', () => {
		expect(resourceCostRefusal(hero(5) as never, [mana(2), mana(3)])).toBeNull();
	});

	it('lists only the second of 3 and 3 mana of 5 as beyond what the creature has', async () => {
		const first = mana(3, 'allowed');
		const second = mana(3, 'allowed');
		const confirmBeyond = vi.fn(async () => true);

		const spent = await spendResourceCosts(hero(5) as never, [first, second], { confirmBeyond });

		expect(confirmBeyond).toHaveBeenCalledWith([second]);
		expect(spent?.beyond).toEqual([second]);
	});

	it('gives back the earlier costs when a later spend throws', async () => {
		const actor = hero(5);
		actor.update.mockImplementationOnce(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		});
		actor.update.mockImplementationOnce(async () => {
			throw new Error('update failed');
		});

		await expect(spendResourceCosts(actor as never, [mana(2), mana(1)])).rejects.toThrow(
			'update failed',
		);
		expect(actor.system.resources.mana.current).toBe(5);
	});
});
