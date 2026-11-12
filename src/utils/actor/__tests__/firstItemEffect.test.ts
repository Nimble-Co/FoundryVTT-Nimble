import { describe, expect, it } from 'vitest';
import { firstItemEffect } from '../firstItemEffect.js';

describe('firstItemEffect', () => {
	it('gives the first effect that stays on the item', () => {
		const onActor = { name: 'Passive', transfer: true };
		const first = { name: 'Given', transfer: false };
		const second = { name: 'Other', transfer: false };
		expect(firstItemEffect({ effects: [onActor, first, second] })).toBe(first);
	});

	it('is null when every effect goes on the actor, or there is no item', () => {
		expect(firstItemEffect({ effects: [{ transfer: true }, {}] })).toBeNull();
		expect(firstItemEffect({})).toBeNull();
		expect(firstItemEffect(null)).toBeNull();
	});
});
