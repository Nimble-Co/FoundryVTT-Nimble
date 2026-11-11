import { describe, expect, it } from 'vitest';
import { itemEffectOf } from '#utils/actor/itemEffectOf.js';

function itemWith(...effects: Array<{ id: string; transfer?: boolean }>) {
	return { effects: new Map(effects.map((effect) => [effect.id, effect])) };
}

describe('itemEffectOf', () => {
	it('gives the effect when it is on the item and not applied to the actor', () => {
		const effect = { id: 'fx1', transfer: false };

		expect(itemEffectOf(itemWith(effect), 'fx1')).toBe(effect);
	});

	it('gives null for an effect that is applied to the actor', () => {
		expect(itemEffectOf(itemWith({ id: 'fx1', transfer: true }), 'fx1')).toBeNull();
		expect(itemEffectOf(itemWith({ id: 'fx1' }), 'fx1')).toBeNull();
	});

	it('gives null when the id is not on the item', () => {
		expect(itemEffectOf(itemWith({ id: 'fx1', transfer: false }), 'gone')).toBeNull();
	});

	it('gives null for a blank or missing id', () => {
		const item = itemWith({ id: 'fx1', transfer: false });

		expect(itemEffectOf(item, '')).toBeNull();
		expect(itemEffectOf(item, null)).toBeNull();
		expect(itemEffectOf(item, undefined)).toBeNull();
	});

	it('gives null when there is no item or the item has no effects', () => {
		expect(itemEffectOf(null, 'fx1')).toBeNull();
		expect(itemEffectOf({ effects: null }, 'fx1')).toBeNull();
	});
});
