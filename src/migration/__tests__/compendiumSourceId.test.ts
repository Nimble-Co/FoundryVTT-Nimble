import { describe, expect, it } from 'vitest';
import { isCompendiumId, toPackSourceId } from '../compendiumSourceId.js';

describe('toPackSourceId', () => {
	it('moves an old class feature pack id to the current pack', () => {
		expect(toPackSourceId('Compendium.nimble.class-features.Item.abc')).toBe(
			'Compendium.nimble.nimble-class-features.Item.abc',
		);
		expect(toPackSourceId('Compendium.nimble-dev.class-features.Item.abc')).toBe(
			'Compendium.nimble.nimble-class-features.Item.abc',
		);
	});

	it('keeps any other id as its snapshot id', () => {
		expect(toPackSourceId('Compendium.nimble-dev.nimble-spells.Item.xyz')).toBe(
			'Compendium.nimble.nimble-spells.Item.xyz',
		);
		expect(toPackSourceId('Item.local')).toBe('Item.local');
		expect(toPackSourceId(undefined)).toBeUndefined();
	});
});

describe('isCompendiumId', () => {
	it('is true only for an id of a compendium entry', () => {
		expect(isCompendiumId('Compendium.nimble.nimble-spells.Item.xyz')).toBe(true);
		expect(isCompendiumId('Item.local')).toBe(false);
		expect(isCompendiumId('')).toBe(false);
		expect(isCompendiumId(undefined)).toBe(false);
	});
});
