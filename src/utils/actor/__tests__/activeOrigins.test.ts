import { describe, expect, it } from 'vitest';
import { activeOrigins } from '../activeOrigins.ts';

const RAGE = 'Actor.hero.Item.rage';
const BLESS = 'Actor.cleric.Item.bless';

describe('activeOrigins', () => {
	it('gives the origin of each active effect on the actor', () => {
		const origins = activeOrigins([
			{ origin: RAGE, active: true },
			{ origin: BLESS, active: true },
		]);

		expect([...origins]).toEqual([RAGE, BLESS]);
	});

	it('leaves out an effect that is off or suppressed, and an effect with no origin', () => {
		const origins = activeOrigins([
			{ origin: RAGE, active: false },
			{ origin: null, active: true },
			{ active: true },
		]);

		expect(origins.size).toBe(0);
	});
});
