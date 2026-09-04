import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { extractVariableChargeSpends } from './itemActivationConfigDialogHelpers.js';

type Rule = Record<string, unknown> & { type: string };

// Driven through the real charge-pool helpers rather than fakes: the bounds this
// returns come from a rule and the pool state it resolves to, and a fake pool
// would stop proving they line up.
function createItem(rules: Rule[], storedCurrent?: number) {
	return {
		id: 'item-1',
		name: 'Flexible Feature',
		rules: new Map(rules.map((rule, index) => [String(index), rule])),
		flags:
			storedCurrent === undefined
				? {}
				: {
						[SYSTEM_ID]: {
							chargePools: {
								focus: { identifier: 'focus', current: storedCurrent, max: 10 },
							},
						},
					},
	};
}

function createActor(item: ReturnType<typeof createItem>) {
	return {
		type: 'character',
		system: { levelUpHistory: [] },
		items: { contents: [item], get: (id: string) => (item.id === id ? item : undefined) },
		flags: {},
		getRollData: vi.fn(() => ({})),
	} as unknown as Actor;
}

function createPoolRule(overrides: Record<string, unknown> = {}): Rule {
	return {
		type: 'chargePool',
		id: 'pool-rule',
		identifier: 'focus',
		label: 'Focus',
		scope: 'item',
		max: '10',
		initial: 'max',
		...overrides,
	};
}

function createConsumerRule(overrides: Record<string, unknown> = {}): Rule {
	return {
		type: 'chargeConsumer',
		id: 'consumer-rule',
		poolIdentifier: 'focus',
		poolScope: 'item',
		costMode: 'variable',
		cost: '1',
		maxCost: '',
		...overrides,
	};
}

function extract(rules: Rule[], storedCurrent?: number) {
	const item = createItem(rules, storedCurrent);
	return extractVariableChargeSpends(createActor(item), item as unknown as Item);
}

describe('extractVariableChargeSpends', () => {
	it('bounds the spend by the consumer cost and the pool remainder', () => {
		expect(extract([createPoolRule(), createConsumerRule()], 8)).toEqual([
			expect.objectContaining({
				poolId: 'focus',
				identifier: 'focus',
				current: 8,
				max: 10,
				minimum: 1,
				limit: 8,
			}),
		]);
	});

	it('caps the spend at maxCost when that is lower than the remainder', () => {
		expect(extract([createPoolRule(), createConsumerRule({ maxCost: '3' })])[0].limit).toBe(3);
	});

	it('raises the minimum to the consumer cost', () => {
		expect(extract([createPoolRule(), createConsumerRule({ cost: '4' })])[0].minimum).toBe(4);
	});

	it('offers nothing when the pool cannot cover the minimum', () => {
		expect(extract([createPoolRule({ max: '3' }), createConsumerRule({ cost: '4' })])).toEqual([]);
	});

	it('ignores a fixed consumer', () => {
		expect(extract([createPoolRule(), createConsumerRule({ costMode: 'fixed' })])).toEqual([]);
	});

	it('leaves a hidden pool out, since it gates a feature rather than budgets one', () => {
		expect(extract([createPoolRule({ hidden: true }), createConsumerRule()])).toEqual([]);
	});
});
