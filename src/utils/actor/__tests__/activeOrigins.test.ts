import { describe, expect, it } from 'vitest';
import { activeOrigins } from '../activeOrigins.ts';

const RAGE = 'Actor.hero.Item.rage';
const BLESS = 'Actor.cleric.Item.bless';

describe('activeOrigins', () => {
	it('gives the origin of each enabled effect on the actor', () => {
		const origins = activeOrigins([
			{ origin: RAGE, disabled: false },
			{ origin: BLESS, disabled: false },
		]);

		expect([...origins]).toEqual([RAGE, BLESS]);
	});

	it('leaves out an effect that is off, and an effect with no origin', () => {
		const origins = activeOrigins([
			{ origin: RAGE, disabled: true },
			{ origin: null, disabled: false },
			{ disabled: false },
		]);

		expect(origins.size).toBe(0);
	});
});
