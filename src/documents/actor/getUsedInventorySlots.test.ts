import { describe, expect, it } from 'vitest';

import {
	createCarriedContainer as makeContainer,
	createCarriedObject as makeObject,
	type ContainableObjectStub as ObjectStub,
} from '../../../tests/fixtures/containableObject.js';
import { NimbleCharacter } from './character.js';

/** Only the fields `getUsedInventorySlots` reads off an actor. */
function makeStub(objects: ObjectStub[], includeCurrencyBulk = false, goldPieces = 0) {
	return {
		items: { forEach: (callback: (item: ObjectStub) => void) => objects.forEach(callback) },
		system: { currency: { gp: { value: goldPieces } } },
		getFlag: () => includeCurrencyBulk,
		getCarriedObjects: NimbleCharacter.prototype.getCarriedObjects,
	} as unknown as NimbleCharacter;
}

function countSlots(...args: Parameters<typeof makeStub>): number {
	return NimbleCharacter.prototype.getUsedInventorySlots.call(makeStub(...args));
}

describe('getUsedInventorySlots', () => {
	it('skips items that are not objects', () => {
		const feature = { isType: () => false } as unknown as ObjectStub;

		expect(countSlots([feature, makeObject('sword', { slotsRequired: 2 })])).toBe(2);
	});

	it('applies the rule of the container an object is stored in', () => {
		const bagOfHolding = makeContainer('bag', { slotCostMode: 'ignore' });
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'bag' });

		expect(countSlots([bagOfHolding, armor])).toBe(1);
	});

	it('charges a stored object in full for a container on the default normal slot cost', () => {
		const chest = makeContainer('chest');
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'chest' });

		expect(countSlots([chest, armor])).toBe(5);
	});

	it('adds a slot per 500 coins on top of the objects carried', () => {
		expect(countSlots([makeObject('sword', { slotsRequired: 2 })], true, 1000)).toBe(4);
	});
});
