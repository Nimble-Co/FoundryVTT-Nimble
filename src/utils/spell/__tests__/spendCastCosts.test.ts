import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CastCostPayer, ResolvedSpellCost } from '#types/spellCost.d.ts';
import { spendCastCosts } from '../spendCastCosts.js';

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
		overdraftResolvedAtTable: false,
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
	return { actor: actor as unknown as CastCostPayer, item, flags };
}

afterEach(() => {
	(globalThis as unknown as { game: { settings?: unknown } }).game.settings = undefined;
});

describe('spendCastCosts', () => {
	it('refuses a cast the pool cannot cover', async () => {
		setResourceSpendingAutomation(true);
		const { actor } = createActor(0);

		const payment = await spendCastCosts(actor, poolCost(), {
			confirmOverdraft: () => true,
		});

		expect(payment.paid).toBe(false);
		expect(payment.failure?.code).toBe('insufficientCharges');
	});

	it('reports a cancelled overdraw without a failure to notify', async () => {
		setResourceSpendingAutomation(true);
		const { actor } = createActor(0);

		const payment = await spendCastCosts(
			actor,
			poolCost({ overdraftConsequence: 'halfMaxHpDamage' }),
			{ confirmOverdraft: () => false },
		);

		expect(payment).toEqual({ paid: false, cancelled: true });
	});

	it('applies the declared consequence when the caster confirms an overdraw', async () => {
		setResourceSpendingAutomation(true);
		const { actor } = createActor(0);

		const payment = await spendCastCosts(
			actor,
			poolCost({ overdraftConsequence: 'halfMaxHpDamage' }),
			{ confirmOverdraft: () => true },
		);

		expect(payment).toMatchObject({ paid: true, overdrawn: true, damage: 10 });
	});

	it('pays without the consequence when the pool refills while the overdraw is confirmed', async () => {
		// The window the re-check exists to close: the first check saw an empty
		// pool, then the awaited confirmation let something else refill it. The
		// cast is then an ordinary payment, not an overdraw.
		setResourceSpendingAutomation(true);
		const { actor, flags } = createActor(0);

		const payment = await spendCastCosts(
			actor,
			poolCost({ overdraftConsequence: 'halfMaxHpDamage' }),
			{
				confirmOverdraft: async () => {
					flags.nimble.chargePools['pilfered-power'].current = 3;
					return true;
				},
			},
		);

		expect(payment).toMatchObject({ paid: true, receipt: { paid: { charges: 1 } } });
		expect(payment.overdrawn).toBeUndefined();
		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(flags.nimble.chargePools['pilfered-power'].current).toBe(2);
	});

	it('asks to confirm only the second of two HP costs that together go beyond the HP', async () => {
		setResourceSpendingAutomation(true);
		const actor = {
			system: { resources: { mana: { current: 0 } }, attributes: { hp: { value: 10, max: 20 } } },
			update: vi.fn(async () => ({})),
		};
		const hpCost = (source: string) => ({
			kind: 'hp' as const,
			amount: 5,
			spend: { mode: 'fixed' as const },
			beyond: 'allowed' as const,
			source,
		});
		const first = hpCost('First');
		const second = hpCost('Second');
		const confirmBeyond = vi.fn(async () => true);

		await spendCastCosts(
			actor as unknown as CastCostPayer,
			{ type: 'none' },
			{
				confirmOverdraft: () => true,
				costs: [first, second],
				confirmBeyond,
			},
		);

		expect(confirmBeyond).toHaveBeenCalledWith([second]);
	});

	it('gives back the spell mana when a later cost throws', async () => {
		setResourceSpendingAutomation(true);
		const failure = new Error('update failed');
		const actor = {
			system: { resources: { mana: { current: 5 } }, attributes: { hp: { value: 10, max: 20 } } },
			update: vi.fn(async (changes: Record<string, unknown>) => {
				if ('system.attributes.hp.value' in changes) throw failure;
				for (const [path, value] of Object.entries(changes)) {
					foundry.utils.setProperty(actor, path, value);
				}
			}),
		};
		const hpCost = {
			kind: 'hp' as const,
			amount: 2,
			spend: { mode: 'fixed' as const },
			beyond: 'notAllowed' as const,
		};

		await expect(
			spendCastCosts(
				actor as unknown as CastCostPayer,
				{ type: 'mana', amount: 3 },
				{
					confirmOverdraft: () => true,
					costs: [hpCost],
				},
			),
		).rejects.toBe(failure);

		expect(actor.system.resources.mana.current).toBe(5);
	});

	it('pays without touching anything when spending automation is off', async () => {
		setResourceSpendingAutomation(false);
		const { actor, item } = createActor(0);

		const payment = await spendCastCosts(actor, poolCost(), { confirmOverdraft: () => false });

		expect(payment).toMatchObject({ paid: true, receipt: { paid: { charges: 0 } } });
		expect(item.update).not.toHaveBeenCalled();
	});
});
