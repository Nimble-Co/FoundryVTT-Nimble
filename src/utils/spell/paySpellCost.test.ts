import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedSpellCost, SpellCostActorLike } from '#types/spellCost.d.ts';
import { paySpellCost } from './paySpellCost.js';

function setResourceSpendingAutomation(enabled: boolean): void {
	(
		globalThis as unknown as { game: { settings?: { get: ReturnType<typeof vi.fn> } } }
	).game.settings = { get: vi.fn(() => enabled) };
}

function poolCost(overrides: Partial<Extract<ResolvedSpellCost, { type: 'pool' }>> = {}) {
	return {
		type: 'pool' as const,
		poolIdentifier: 'pilfered-power',
		poolLabel: 'Pilfered Power',
		amount: 1,
		overdraftConsequence: '' as const,
		...overrides,
	};
}

/** An actor holding one item-scoped charge pool, whose value the test can move. */
function createActor(current: number, max = 3) {
	const flags = {
		nimble: {
			chargePools: {
				'pilfered-power': {
					identifier: 'pilfered-power',
					current,
					max,
					recoveries: [],
				},
			},
		},
	};
	const item = {
		id: 'item-1',
		name: 'Pilfered Power',
		type: 'feature',
		system: {},
		rules: new Map([
			[
				'0',
				{
					type: 'chargePool',
					id: 'rule-1',
					identifier: 'pilfered-power',
					label: 'Pilfered Power',
					scope: 'item',
					max: String(max),
					initial: 'max',
					recoveries: [],
				},
			],
		]),
		flags,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const payload = changes['flags.nimble.chargePools'] as Record<string, unknown> | undefined;
			if (payload) flags.nimble.chargePools = payload as typeof flags.nimble.chargePools;
			return {};
		}),
	};
	const actor = {
		type: 'character',
		system: { resources: { mana: { current: 0 } }, attributes: { hp: { max: 20 } } },
		items: { contents: [item], get: () => item },
		flags: { nimble: { chargePools: {} } },
		getRollData: () => ({}),
		getFlag: () => undefined,
		update: vi.fn(async () => ({})),
		applyDamage: vi.fn(async () => undefined),
	};
	return { actor: actor as unknown as SpellCostActorLike, item, flags };
}

afterEach(() => {
	(globalThis as unknown as { game: { settings?: unknown } }).game.settings = undefined;
});

describe('paySpellCost', () => {
	it('refuses a cast the pool cannot cover', async () => {
		setResourceSpendingAutomation(true);
		const { actor } = createActor(0);

		const payment = await paySpellCost(actor, poolCost(), {
			confirmOverdraft: () => true,
		});

		expect(payment.paid).toBe(false);
		expect(payment.failure?.code).toBe('insufficientCharges');
	});

	it('reports a cancelled overdraw without a failure to notify', async () => {
		setResourceSpendingAutomation(true);
		const { actor } = createActor(0);

		const payment = await paySpellCost(
			actor,
			poolCost({ overdraftConsequence: 'halfMaxHpDamage' }),
			{ confirmOverdraft: () => false },
		);

		expect(payment).toEqual({ paid: false, cancelled: true });
	});

	it('applies the declared consequence when the caster confirms an overdraw', async () => {
		setResourceSpendingAutomation(true);
		const { actor } = createActor(0);

		const payment = await paySpellCost(
			actor,
			poolCost({ overdraftConsequence: 'halfMaxHpDamage' }),
			{ confirmOverdraft: () => true },
		);

		expect(payment).toMatchObject({ paid: true, overdrawn: true, damage: 10 });
	});

	it('does not pay when the pool drains while the overdraw is being confirmed', async () => {
		// The window this operation exists to close: the check passed, then an
		// awaited confirmation let something else empty the pool.
		setResourceSpendingAutomation(true);
		const { actor, flags } = createActor(2);

		const payment = await paySpellCost(actor, poolCost({ amount: 2 }), {
			confirmOverdraft: () => true,
		});
		expect(payment.paid).toBe(true);

		const second = await paySpellCost(actor, poolCost({ amount: 2 }), {
			confirmOverdraft: async () => {
				flags.nimble.chargePools['pilfered-power'].current = 0;
				return true;
			},
		});

		expect(second.paid).toBe(false);
		expect(second.failure?.code).toBe('insufficientCharges');
	});

	it('pays without touching anything when spending automation is off', async () => {
		setResourceSpendingAutomation(false);
		const { actor, item } = createActor(0);

		const payment = await paySpellCost(actor, poolCost(), { confirmOverdraft: () => false });

		expect(payment).toEqual({ paid: true });
		expect(item.update).not.toHaveBeenCalled();
	});
});
