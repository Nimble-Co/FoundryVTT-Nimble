import { describe, expect, it, vi } from 'vitest';
import { getResourcePools } from './chargePoolSync.js';
import type { CharacterActorLike, ChargePoolRuleLike } from './types.js';

type MockRule = ChargePoolRuleLike & { type: string; id: string };

type MockItem = {
	id: string;
	name: string;
	rules: Map<string, MockRule>;
	flags: Record<string, Record<string, unknown>>;
};

function createPoolItem(
	id: string,
	name: string,
	rule: Partial<ChargePoolRuleLike> & { identifier: string },
): MockItem {
	const fullRule: MockRule = {
		type: 'chargePool',
		id: `${id}-pool`,
		scope: 'item',
		max: '3',
		initial: 'max',
		...rule,
	};
	return {
		id,
		name,
		rules: new Map([['0', fullRule]]),
		flags: {},
	};
}

function createMockActor(items: MockItem[]): CharacterActorLike {
	return {
		type: 'character',
		system: { levelUpHistory: [] },
		items: {
			contents: items,
			get: (id: string) => items.find((item) => item.id === id),
		},
		flags: {},
		getRollData: vi.fn(() => ({})),
	} as unknown as CharacterActorLike;
}

describe('getResourcePools', () => {
	it('returns only the pools that opt in to the header', () => {
		const actor = createMockActor([
			createPoolItem('item-1', 'Pilfered Power', {
				identifier: 'pilfered-power',
				showAsResource: true,
			}),
			createPoolItem('item-2', 'Hold the Line', { identifier: 'hold-the-line' }),
		]);

		expect(getResourcePools(actor).map((pool) => pool.identifier)).toEqual(['pilfered-power']);
	});

	it('does not promote a hidden pool even when it opts in', () => {
		const actor = createMockActor([
			createPoolItem('item-1', 'Gate', {
				identifier: 'gate',
				hidden: true,
				showAsResource: true,
			}),
		]);

		expect(getResourcePools(actor)).toEqual([]);
	});

	it('returns nothing when no pool opts in', () => {
		const actor = createMockActor([
			createPoolItem('item-1', 'Combat Dice', { identifier: 'combat-dice' }),
		]);

		expect(getResourcePools(actor)).toEqual([]);
	});

	it('carries the label, current and max the header needs', () => {
		const actor = createMockActor([
			createPoolItem('item-1', 'Pilfered Power', {
				identifier: 'pilfered-power',
				max: '4',
				showAsResource: true,
			}),
		]);

		expect(getResourcePools(actor)[0]).toMatchObject({
			label: 'Pilfered Power',
			current: 4,
			max: 4,
			showAsResource: true,
		});
	});

	it('orders promoted pools the way the full pool list is ordered', () => {
		const actor = createMockActor([
			createPoolItem('item-1', 'Zeal', { identifier: 'zeal', showAsResource: true }),
			createPoolItem('item-2', 'Anima', { identifier: 'anima', showAsResource: true }),
		]);

		expect(getResourcePools(actor).map((pool) => pool.label)).toEqual(['Anima', 'Zeal']);
	});

	it('returns nothing for an actor that is not a character', () => {
		expect(getResourcePools(null)).toEqual([]);
	});
});
