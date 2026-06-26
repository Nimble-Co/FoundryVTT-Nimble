import { describe, expect, it } from 'vitest';
import {
	computeNextToggledList,
	getToggledTargetTags,
	isEntryExpired,
	type ToggledTargetEntry,
} from './toggledEffects.js';

function entry(overrides: Partial<ToggledTargetEntry> = {}): ToggledTargetEntry {
	return {
		actorUuid: 'Actor.a',
		tokenUuid: 'Scene.s.Token.t',
		name: 'Goblin',
		markedAt: 0,
		durationDays: null,
		...overrides,
	};
}

describe('toggledEffects', () => {
	describe('isEntryExpired', () => {
		it('never expires entries with a null duration', () => {
			expect(isEntryExpired(entry({ durationDays: null }), 10_000_000)).toBe(false);
		});

		it('expires once the duration window has elapsed', () => {
			const e = entry({ markedAt: 0, durationDays: 1 });
			expect(isEntryExpired(e, 86_399)).toBe(false);
			expect(isEntryExpired(e, 86_400)).toBe(true);
		});
	});

	describe('computeNextToggledList', () => {
		it('appends a new mark when under capacity', () => {
			const { list, evicted } = computeNextToggledList([], entry({ actorUuid: 'Actor.a' }), 1, 0);
			expect(list).toHaveLength(1);
			expect(list[0].actorUuid).toBe('Actor.a');
			expect(evicted).toHaveLength(0);
		});

		it('re-marking the same target refreshes rather than duplicates', () => {
			const current = [entry({ actorUuid: 'Actor.a', markedAt: 0 })];
			const { list, evicted } = computeNextToggledList(
				current,
				entry({ actorUuid: 'Actor.a', markedAt: 50 }),
				1,
				50,
			);
			expect(list).toHaveLength(1);
			expect(list[0].markedAt).toBe(50);
			expect(evicted).toHaveLength(0);
		});

		it('evicts the oldest mark when capacity is exceeded', () => {
			const current = [entry({ actorUuid: 'Actor.a' })];
			const { list, evicted } = computeNextToggledList(
				current,
				entry({ actorUuid: 'Actor.b' }),
				1,
				0,
			);
			expect(list.map((e) => e.actorUuid)).toEqual(['Actor.b']);
			expect(evicted.map((e) => e.actorUuid)).toEqual(['Actor.a']);
		});

		it('treats capacity 0 as unlimited', () => {
			const current = [entry({ actorUuid: 'Actor.a' }), entry({ actorUuid: 'Actor.b' })];
			const { list, evicted } = computeNextToggledList(
				current,
				entry({ actorUuid: 'Actor.c' }),
				0,
				0,
			);
			expect(list).toHaveLength(3);
			expect(evicted).toHaveLength(0);
		});

		it('drops expired entries when computing the next list', () => {
			const current = [entry({ actorUuid: 'Actor.a', markedAt: 0, durationDays: 1 })];
			const { list } = computeNextToggledList(current, entry({ actorUuid: 'Actor.b' }), 0, 100_000);
			expect(list.map((e) => e.actorUuid)).toEqual(['Actor.b']);
		});
	});

	describe('getToggledTargetTags', () => {
		const attacker = {
			getFlag: () => ({
				quarry: [entry({ actorUuid: 'Actor.target', durationDays: 1, markedAt: 0 })],
			}),
		};

		it('emits target:<flagKey> for a live matching mark', () => {
			const tags = getToggledTargetTags(attacker, { uuid: 'Actor.target' }, 100);
			expect(tags.has('target:quarry')).toBe(true);
		});

		it('omits the tag for a different target', () => {
			const tags = getToggledTargetTags(attacker, { uuid: 'Actor.other' }, 100);
			expect(tags.has('target:quarry')).toBe(false);
		});

		it('omits the tag once the mark has expired', () => {
			const tags = getToggledTargetTags(attacker, { uuid: 'Actor.target' }, 100_000);
			expect(tags.has('target:quarry')).toBe(false);
		});

		it('returns an empty set when attacker or target is missing', () => {
			expect(getToggledTargetTags(null, { uuid: 'Actor.target' }).size).toBe(0);
			expect(getToggledTargetTags(attacker, null).size).toBe(0);
		});
	});
});
