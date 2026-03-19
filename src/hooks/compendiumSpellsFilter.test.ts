import { describe, expect, it } from 'vitest';
import {
	isSupportedSpellCompendium,
	mapTierForCompendiumDisplay,
} from './compendiumSpellsFilter.js';

describe('mapTierForCompendiumDisplay', () => {
	it('maps utility spells to display tier 0', () => {
		expect(mapTierForCompendiumDisplay(0, ['utilitySpell'])).toBe(0);
		expect(mapTierForCompendiumDisplay(5, ['range', 'utilitySpell'])).toBe(0);
	});

	it('maps cantrips (raw tier 0) to display tier 1', () => {
		expect(mapTierForCompendiumDisplay(0, ['range'])).toBe(1);
	});

	it('maps tiered spells one level higher for display', () => {
		expect(mapTierForCompendiumDisplay(1, ['range'])).toBe(2);
		expect(mapTierForCompendiumDisplay(2, ['concentration'])).toBe(3);
		expect(mapTierForCompendiumDisplay(9, ['reach'])).toBe(10);
	});

	it('handles tier values provided as strings from index data', () => {
		expect(mapTierForCompendiumDisplay('0', ['range'])).toBe(1);
		expect(mapTierForCompendiumDisplay('3', ['range'])).toBe(4);
	});

	it('falls back to cantrip display tier for invalid non-utility values', () => {
		expect(mapTierForCompendiumDisplay(undefined, ['range'])).toBe(1);
		expect(mapTierForCompendiumDisplay('not-a-number', ['range'])).toBe(1);
	});
});

describe('isSupportedSpellCompendium', () => {
	it('supports both public spell compendia', () => {
		expect(isSupportedSpellCompendium('nimble.nimble-spells')).toBe(true);
		expect(isSupportedSpellCompendium('nimble.nimble-secret-spells')).toBe(true);
	});

	it('rejects non-spell compendia', () => {
		expect(isSupportedSpellCompendium('nimble.nimble-items')).toBe(false);
		expect(isSupportedSpellCompendium(undefined)).toBe(false);
	});
});
