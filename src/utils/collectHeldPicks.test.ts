import { describe, expect, it } from 'vitest';

import collectHeldPicks, {
	countHeldPicks,
	type HeldFeature,
	type HeldPickHistoryEntry,
	type HeldPickPool,
} from './collectHeldPicks.ts';

function feature(id: string, compendiumSource: string | null = null): HeldFeature {
	return { id, compendiumSource };
}

function pool(poolKey: string, candidateUuids: string[]): HeldPickPool {
	return { poolKey, candidateUuids };
}

function entry(level: number, grantedFeatureIds: string[]): HeldPickHistoryEntry {
	return { level, grantedFeatureIds };
}

describe('collectHeldPicks', () => {
	it('counts two features with the same source as two held ids under one member', () => {
		const held = collectHeldPicks(
			[feature('item-die-a', 'uuid:die'), feature('item-die-b', 'uuid:die')],
			[pool('combat', ['uuid:die', 'uuid:tactic'])],
			[],
		);

		expect(held.get('combat')?.get('uuid:die')).toEqual(['item-die-a', 'item-die-b']);
	});

	it('holds a feature nowhere when its source is in no pool', () => {
		const held = collectHeldPicks(
			[feature('item-boon', 'uuid:boon')],
			[pool('combat', ['uuid:die', 'uuid:tactic'])],
			[],
		);

		expect(held.get('combat')?.size).toBe(0);
	});

	it('holds a feature nowhere when it has no source', () => {
		const held = collectHeldPicks(
			[feature('item-hand-written')],
			[pool('combat', ['uuid:die', 'uuid:tactic'])],
			[],
		);

		expect(held.get('combat')?.size).toBe(0);
	});

	it('matches a dev namespace source against the stable member and keys it under the candidate', () => {
		const held = collectHeldPicks(
			[feature('item-order', 'Compendium.nimble-dev.nimble-class-features.Item.X')],
			[pool('combat', ['Compendium.nimble.nimble-class-features.Item.X', 'uuid:die'])],
			[],
		);

		expect(held.get('combat')?.get('Compendium.nimble.nimble-class-features.Item.X')).toEqual([
			'item-order',
		]);
	});

	it('lists ids a history entry names first, oldest level first, and untracked ids last', () => {
		const held = collectHeldPicks(
			[
				feature('item-die-c', 'uuid:die'),
				feature('item-die-a', 'uuid:die'),
				feature('item-die-b', 'uuid:die'),
			],
			[pool('combat', ['uuid:die', 'uuid:tactic'])],
			[entry(8, ['item-die-b']), entry(6, ['item-die-a'])],
		);

		expect(held.get('combat')?.get('uuid:die')).toEqual(['item-die-a', 'item-die-b', 'item-die-c']);
	});

	it('lists an id two history entries name once', () => {
		const held = collectHeldPicks(
			[feature('item-die-a', 'uuid:die'), feature('item-die-b', 'uuid:die')],
			[pool('combat', ['uuid:die', 'uuid:tactic'])],
			[entry(6, ['item-die-a']), entry(8, ['item-die-a', 'item-die-b'])],
		);

		expect(held.get('combat')?.get('uuid:die')).toEqual(['item-die-a', 'item-die-b']);
	});

	it('gives every pool key an empty map when the character has no feature items', () => {
		const held = collectHeldPicks(
			[],
			[pool('combat', ['uuid:die', 'uuid:tactic']), pool('mastery', ['uuid:axe', 'uuid:bow'])],
			[],
		);

		expect([...held.keys()]).toEqual(['combat', 'mastery']);
		expect(held.get('combat')?.size).toBe(0);
		expect(held.get('mastery')?.size).toBe(0);
	});

	it('counts a member two pools both offer in both pools', () => {
		// Current behaviour. The collector keeps pools disjoint, so this cannot happen in practice.
		const held = collectHeldPicks(
			[feature('item-die-a', 'uuid:die')],
			[pool('combat', ['uuid:die', 'uuid:tactic']), pool('mastery', ['uuid:die', 'uuid:axe'])],
			[],
		);

		expect(held.get('combat')?.get('uuid:die')).toEqual(['item-die-a']);
		expect(held.get('mastery')?.get('uuid:die')).toEqual(['item-die-a']);
	});

	it('counts the held picks of a pool across every member, copies included', () => {
		const held = collectHeldPicks(
			[feature('a', 'uuid:die'), feature('b', 'uuid:die'), feature('c', 'uuid:tactic')],
			[pool('combat', ['uuid:die', 'uuid:tactic', 'uuid:order'])],
			[],
		);

		expect(countHeldPicks(held.get('combat')!)).toBe(3);
		expect(countHeldPicks(new Map())).toBe(0);
	});
});
