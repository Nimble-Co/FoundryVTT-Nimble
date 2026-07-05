import { describe, expect, it } from 'vitest';
import { buildMonsterPrototypeTokenDefaults } from './monsterPrototypeTokenDefaults.js';

describe('buildMonsterPrototypeTokenDefaults', () => {
	it('returns hostile, unlinked, sighted defaults with visible bars', () => {
		const defaults = buildMonsterPrototypeTokenDefaults();

		expect(defaults).toEqual({
			sight: { enabled: true },
			actorLink: false,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
			displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
		});
	});

	it('returns a fresh object each call so callers cannot share mutable state', () => {
		const first = buildMonsterPrototypeTokenDefaults();
		const second = buildMonsterPrototypeTokenDefaults();

		expect(first).not.toBe(second);
		expect(first.sight).not.toBe(second.sight);
	});
});
