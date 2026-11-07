import { afterEach, describe, expect, it } from 'vitest';
import { registerSpecialStatusEffects, STATUS_EFFECT_IDS } from '../registerConditionsConfig.js';

describe('registerSpecialStatusEffects', () => {
	const original = CONFIG.specialStatusEffects;

	afterEach(() => {
		CONFIG.specialStatusEffects = original;
	});

	it("gives core's blindness the Blinded condition", () => {
		CONFIG.specialStatusEffects = {
			DEFEATED: 'dead',
			INVISIBLE: 'invisible',
			BLIND: 'blind',
		} as never;

		registerSpecialStatusEffects();

		expect(CONFIG.specialStatusEffects.BLIND).toBe(STATUS_EFFECT_IDS.blinded);
	});

	it('keeps the other special status effects', () => {
		CONFIG.specialStatusEffects = {
			DEFEATED: 'dead',
			INVISIBLE: 'invisible',
			BLIND: 'blind',
		} as never;

		registerSpecialStatusEffects();

		expect(CONFIG.specialStatusEffects.DEFEATED).toBe('dead');
		expect(CONFIG.specialStatusEffects.INVISIBLE).toBe('invisible');
	});
});
