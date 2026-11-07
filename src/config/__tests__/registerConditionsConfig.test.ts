import { afterEach, describe, expect, it } from 'vitest';
import { registerSpecialStatusEffects, STATUS_EFFECT_IDS } from '../registerConditionsConfig.js';

describe('registerSpecialStatusEffects', () => {
	const original = CONFIG.specialStatusEffects;

	afterEach(() => {
		CONFIG.specialStatusEffects = original;
	});

	it("gives core's blindness the Blinded condition and keeps the other special statuses", () => {
		CONFIG.specialStatusEffects = {
			DEFEATED: 'dead',
			INVISIBLE: 'invisible',
			BLIND: 'blind',
		} as never;

		registerSpecialStatusEffects();

		expect(CONFIG.specialStatusEffects).toEqual({
			DEFEATED: 'dead',
			INVISIBLE: 'invisible',
			BLIND: STATUS_EFFECT_IDS.blinded,
		});
	});
});
