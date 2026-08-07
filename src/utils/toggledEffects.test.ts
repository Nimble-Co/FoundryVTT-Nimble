import { describe, expect, it } from 'vitest';
import {
	computeNextToggledList,
	getToggledTargetTags,
	type ToggledTargetEntry,
} from './toggledEffects.js';

function entry(overrides: Partial<ToggledTargetEntry> = {}): ToggledTargetEntry {
	return {
		actorUuid: 'Actor.a',
		tokenUuid: 'Scene.s.Token.t',
		name: 'Goblin',
		...overrides,
	};
}

describe('toggledEffects', () => {
	describe('computeNextToggledList', () => {
		it('appends a new mark when under capacity', () => {
			const { list, evicted } = computeNextToggledList([], entry({ actorUuid: 'Actor.a' }), 1);
			expect(list).toHaveLength(1);
			expect(list[0].actorUuid).toBe('Actor.a');
			expect(evicted).toHaveLength(0);
		});

		it('re-marking the same target refreshes rather than duplicates', () => {
			const current = [entry({ actorUuid: 'Actor.a', name: 'Old' })];
			const { list, evicted } = computeNextToggledList(
				current,
				entry({ actorUuid: 'Actor.a', name: 'New' }),
				1,
			);
			expect(list).toHaveLength(1);
			expect(list[0].name).toBe('New');
			expect(evicted).toHaveLength(0);
		});

		it('evicts the oldest mark when capacity is exceeded', () => {
			const current = [entry({ actorUuid: 'Actor.a' })];
			const { list, evicted } = computeNextToggledList(current, entry({ actorUuid: 'Actor.b' }), 1);
			expect(list.map((e) => e.actorUuid)).toEqual(['Actor.b']);
			expect(evicted.map((e) => e.actorUuid)).toEqual(['Actor.a']);
		});

		it('treats capacity 0 as unlimited', () => {
			const current = [entry({ actorUuid: 'Actor.a' }), entry({ actorUuid: 'Actor.b' })];
			const { list, evicted } = computeNextToggledList(current, entry({ actorUuid: 'Actor.c' }), 0);
			expect(list).toHaveLength(3);
			expect(evicted).toHaveLength(0);
		});
	});

	describe('getToggledTargetTags', () => {
		const attacker = {
			getFlag: () => ({
				quarry: [entry({ actorUuid: 'Actor.target' })],
			}),
		};

		it('emits target:<flagKey> for a matching mark', () => {
			const tags = getToggledTargetTags(attacker, { uuid: 'Actor.target' });
			expect(tags.has('target:quarry')).toBe(true);
		});

		it('omits the tag for a different target', () => {
			const tags = getToggledTargetTags(attacker, { uuid: 'Actor.other' });
			expect(tags.has('target:quarry')).toBe(false);
		});

		it('returns an empty set when attacker or target is missing', () => {
			expect(getToggledTargetTags(null, { uuid: 'Actor.target' }).size).toBe(0);
			expect(getToggledTargetTags(attacker, null).size).toBe(0);
		});

		it('skips flag keys whose value is not an array (corrupt/legacy flag)', () => {
			const corruptAttacker = { getFlag: () => ({ quarry: 'not-an-array' }) };
			const tags = getToggledTargetTags(corruptAttacker, { uuid: 'Actor.target' });
			expect(tags.size).toBe(0);
		});
	});
});
