import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { UseCost } from '#types/useCost.d.ts';
import { DefendOptionRule } from '../../../models/rules/defendOption.js';
import { canSpendResource, resourceCostsOf, spendResource } from '../resourceCost.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
};

function setResourceSpending(on: boolean): void {
	testGlobals.game.settings = {
		get: (_scope, key) => (key === 'automation.resourceSpending' ? on : true),
	};
}

function useCost(overrides: Partial<UseCost> = {}): UseCost {
	return {
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		...overrides,
	};
}

function fixed(kind: ResourceCost['kind'], amount: number): ResourceCost {
	return { kind, amount, spend: { mode: 'fixed' }, beyond: 'notAllowed' };
}

function hero(options: { mana?: number; wounds?: number; maxWounds?: number } = {}) {
	const actor = {
		system: {
			resources: { mana: { current: options.mana ?? 0, max: 10 } },
			attributes: { wounds: { value: options.wounds ?? 0, max: options.maxWounds ?? 6 } },
		},
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

describe('the cost shape', () => {
	beforeEach(() => setResourceSpending(true));
	afterEach(() => {
		testGlobals.game.settings = undefined;
	});

	describe('reading a use cost', () => {
		it('reads the mana and Wound fields as fixed costs that cannot go beyond what you have', () => {
			expect(resourceCostsOf(useCost({ manaCost: 2, woundCost: 1 }))).toEqual([
				fixed('mana', 2),
				fixed('wounds', 1),
			]);
		});

		it("reads a Defend Option's saved mana cost with no change to its data", () => {
			const rule = new DefendOptionRule({ type: 'defendOption' } as never, {
				parent: { isEmbedded: true, uuid: 'Item.burst' } as never,
				strict: false,
			});
			Object.assign(rule, { chargePoolIdentifier: '', chargeCost: 1, manaCost: 2, woundCost: 0 });
			Object.defineProperty(rule, 'parentDocument', { get: () => ({ uuid: 'Item.burst' }) });

			expect(resourceCostsOf(rule.optionCost)).toEqual([fixed('mana', 2)]);
			expect(rule.manaCost).toBe(2);
		});

		it('reads a free use as no cost', () => {
			expect(resourceCostsOf(useCost())).toEqual([]);
		});
	});

	describe('the check', () => {
		it('allows a mana cost only when the creature has that much mana', () => {
			expect(canSpendResource(hero({ mana: 2 }) as never, fixed('mana', 2))).toBe(true);
			expect(canSpendResource(hero({ mana: 1 }) as never, fixed('mana', 2))).toBe(false);
		});

		it('allows a Wound cost only when every Wound fits below the maximum', () => {
			expect(canSpendResource(hero({ wounds: 4, maxWounds: 6 }) as never, fixed('wounds', 2))).toBe(
				true,
			);
			expect(canSpendResource(hero({ wounds: 5, maxWounds: 6 }) as never, fixed('wounds', 2))).toBe(
				false,
			);
		});

		it('allows every cost when Resource Spending is off', () => {
			setResourceSpending(false);
			expect(canSpendResource(hero({ mana: 0 }) as never, fixed('mana', 3))).toBe(true);
			expect(canSpendResource(hero({ wounds: 6 }) as never, fixed('wounds', 1))).toBe(true);
		});
	});

	describe('the spend', () => {
		it('takes the mana and says how much it took', async () => {
			const actor = hero({ mana: 5 });

			expect(await spendResource(actor as never, fixed('mana', 3))).toBe(3);
			expect(actor.system.resources.mana.current).toBe(2);
		});

		it('takes no mana when the creature has too little', async () => {
			const actor = hero({ mana: 1 });

			expect(await spendResource(actor as never, fixed('mana', 3))).toBeNull();
			expect(actor.update).not.toHaveBeenCalled();
		});

		it('gives the Wounds, and none past the maximum', async () => {
			const actor = hero({ wounds: 4, maxWounds: 6 });

			expect(await spendResource(actor as never, fixed('wounds', 2))).toBe(2);
			expect(actor.system.attributes.wounds.value).toBe(6);
			expect(await spendResource(actor as never, fixed('wounds', 1))).toBeNull();
			expect(actor.system.attributes.wounds.value).toBe(6);
		});

		it('takes nothing when Resource Spending is off', async () => {
			setResourceSpending(false);
			const actor = hero({ mana: 5 });

			expect(await spendResource(actor as never, fixed('mana', 3))).toBe(0);
			expect(actor.update).not.toHaveBeenCalled();
		});
	});
});
