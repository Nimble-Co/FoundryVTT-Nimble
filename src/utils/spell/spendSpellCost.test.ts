import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import { spendSpellCost } from './spendSpellCost.js';

function setResourceSpendingAutomation(enabled: boolean): void {
	(
		globalThis as unknown as { game: { settings?: { get: ReturnType<typeof vi.fn> } } }
	).game.settings = { get: vi.fn(() => enabled) };
}

/**
 * An actor whose one pool rule holds on the first pool-map build and fails on
 * every later one, so the pool is present for validation and gone at the spend.
 */
function createActorWithVanishingPool() {
	const appliesTo = vi.fn();
	appliesTo.mockReturnValueOnce(true).mockReturnValue(false);
	const item = {
		id: 'class-1',
		name: 'Test Class',
		type: 'class',
		system: {},
		rules: new Map([
			[
				'0',
				{
					type: 'chargePool',
					id: 'rule-1',
					identifier: 'stolen-power',
					label: 'Stolen Power',
					scope: 'item',
					max: '3',
					initial: 'max',
					recoveries: [],
					appliesTo,
				},
			],
		]),
		flags: { nimble: { chargePools: {} } },
		update: vi.fn(async () => ({})),
	};
	const actor = {
		type: 'character',
		system: { resources: { mana: { current: 0 } } },
		items: { contents: [item], get: () => item },
		flags: { nimble: { chargePools: {} } },
		getRollData: () => ({}),
		getFlag: () => undefined,
		update: vi.fn(async () => ({})),
	};
	return { actor: actor as unknown as SpellCostActorLike, item, appliesTo };
}

afterEach(() => {
	(globalThis as unknown as { game: { settings?: unknown } }).game.settings = undefined;
});

describe('spendSpellCost', () => {
	it('refuses the cast when the pool vanishes between validation and the spend', async () => {
		setResourceSpendingAutomation(true);
		const { actor, item, appliesTo } = createActorWithVanishingPool();

		const outcome = await spendSpellCost(actor, {
			type: 'pool',
			poolIdentifier: 'stolen-power',
			poolLabel: 'Stolen Power',
			amount: 1,
			overdraftConsequence: '',
			overdraftResolvedAtTable: false,
		});

		// Validation built the pool map once and passed; the spend built it again.
		expect(appliesTo).toHaveBeenCalledTimes(2);
		expect(outcome).toEqual({
			ok: false,
			overdrawn: false,
			failure: {
				code: 'poolMissing',
				poolIdentifier: 'stolen-power',
				poolLabel: 'Stolen Power',
				required: 1,
				available: 0,
			},
		});
		expect(item.update).not.toHaveBeenCalled();
		expect(actor.update).not.toHaveBeenCalled();
	});
});
