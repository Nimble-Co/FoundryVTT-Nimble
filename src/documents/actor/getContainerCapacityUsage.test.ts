import { describe, expect, it } from 'vitest';

import type { ContainableObject } from '#types/inventoryContainers.js';
import {
	createContainableObject,
	createContainer,
} from '../../../tests/fixtures/containableObject.js';
import { NimbleCharacter } from './character.js';

type ObjectStub = ContainableObject & { isType(type: string): boolean };

function asStub(object: ContainableObject): ObjectStub {
	return { ...object, isType: (type: string) => type === 'object' };
}

function makeObject(_id: string, system: Partial<ContainableObject['system']> = {}): ObjectStub {
	return asStub(createContainableObject(_id, system));
}

function usageFor(objects: ObjectStub[]): Record<string, number> {
	const actor = {
		items: { forEach: (callback: (item: ObjectStub) => void) => objects.forEach(callback) },
		getCarriedObjects: NimbleCharacter.prototype.getCarriedObjects,
	} as unknown as NimbleCharacter;

	return NimbleCharacter.prototype.getContainerCapacityUsage.call(actor);
}

describe('getContainerCapacityUsage', () => {
	it('reports nothing stored for a container holding nothing', () => {
		expect(usageFor([asStub(createContainer('chest'))])).toEqual({ chest: 0 });
	});

	it('adds up the stored objects at their own slot cost', () => {
		const chest = asStub(createContainer('chest'));
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'chest' });
		const rope = makeObject('rope', { slotsRequired: 1, containerId: 'chest' });

		expect(usageFor([chest, armor, rope])).toEqual({ chest: 5 });
	});

	it('measures what a bag of holding stores at full cost, not the nothing it charges', () => {
		const bag = asStub(createContainer('bag', { slotCostMode: 'ignore' }));
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'bag' });

		expect(usageFor([bag, armor])).toEqual({ bag: 4 });
	});

	it('keeps each container to what it holds', () => {
		const chest = asStub(createContainer('chest'));
		const pouch = asStub(createContainer('pouch'));
		const armor = makeObject('armor', { slotsRequired: 4, containerId: 'chest' });
		const chalk = makeObject('chalk', { objectSizeType: 'smallSized', containerId: 'pouch' });

		expect(usageFor([chest, pouch, armor, chalk])).toEqual({ chest: 4, pouch: 1 });
	});

	it('leaves out objects that are not containers', () => {
		const sword = makeObject('sword', { slotsRequired: 2 });

		expect(usageFor([sword, asStub(createContainer('chest'))])).toEqual({ chest: 0 });
	});

	it('ignores a container id that names nothing carried', () => {
		const orphan = makeObject('orphan', { slotsRequired: 2, containerId: 'gone' });

		expect(usageFor([orphan])).toEqual({});
	});
});
