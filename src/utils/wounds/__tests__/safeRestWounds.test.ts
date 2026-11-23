import { describe, expect, it } from 'vitest';
import { woundsHealedOnSafeRest } from '../safeRestWounds.js';

function rest(mode: string, value: number, extra: Record<string, unknown> = {}) {
	return {
		type: 'safeRestWounds',
		priority: 1,
		appliesTo: () => true,
		healOnSafeRest: (soFar: number, current: number) => {
			if (mode === 'all') return current;
			if (mode === 'multiply') return soFar * value;
			if (mode === 'replace') return value;
			return soFar + value;
		},
		...extra,
	};
}

describe('woundsHealedOnSafeRest', () => {
	it('heals 1 when no rule says otherwise', () => {
		expect(woundsHealedOnSafeRest({ rules: [] }, 4)).toBe(1);
		expect(woundsHealedOnSafeRest(undefined, 3)).toBe(1);
	});

	it('heals nothing when the creature has no Wounds', () => {
		expect(woundsHealedOnSafeRest({ rules: [rest('all', 0)] }, 0)).toBe(0);
	});

	it('adds, multiplies, replaces, or heals every Wound, and never more than they have', () => {
		expect(woundsHealedOnSafeRest({ rules: [rest('add', 2)] }, 4)).toBe(3);
		expect(woundsHealedOnSafeRest({ rules: [rest('multiply', 3)] }, 4)).toBe(3);
		expect(woundsHealedOnSafeRest({ rules: [rest('replace', 0)] }, 4)).toBe(0);
		expect(woundsHealedOnSafeRest({ rules: [rest('all', 0)] }, 4)).toBe(4);
		expect(woundsHealedOnSafeRest({ rules: [rest('add', 9)] }, 2)).toBe(2);
	});

	it('runs from the lowest priority and skips a rule whose condition fails', () => {
		const actor = {
			rules: [
				rest('add', 1, { priority: 2 }),
				rest('replace', 3, { priority: 1, appliesTo: () => false }),
				rest('add', 2, { priority: 0 }),
			],
		};

		expect(woundsHealedOnSafeRest(actor, 6)).toBe(4);
	});
});
