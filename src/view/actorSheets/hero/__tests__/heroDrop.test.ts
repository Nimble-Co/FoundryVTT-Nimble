import { describe, expect, it } from 'vitest';
import { dropAction, tabOfItemType } from '../heroDrop.ts';

const carried = [
	{ id: 'backpack', uuid: 'Actor.h.Item.backpack', type: 'object', containerId: '' },
	{ id: 'rope', uuid: 'Actor.h.Item.rope', type: 'object', containerId: 'backpack' },
	{ id: 'torch', uuid: 'Actor.h.Item.torch', type: 'object', containerId: '' },
	{ id: 'ignite', uuid: 'Actor.h.Item.ignite', type: 'spell', containerId: '' },
];
const drop = (uuid: string) => ({ type: 'Item', uuid });

describe('dropAction', () => {
	it('creates an item from outside the sheet, in the container of the drop', () => {
		expect(dropAction(carried, drop('Compendium.x.Item.y'), 'backpack')).toEqual({
			kind: 'create',
			containerId: 'backpack',
		});
		expect(dropAction(carried, drop('Compendium.x.Item.y'), null)).toEqual({
			kind: 'create',
			containerId: '',
		});
	});

	it('stores a carried object dropped on a container, and takes a stored one out on the list', () => {
		expect(dropAction(carried, drop('Actor.h.Item.torch'), 'backpack')).toEqual({
			kind: 'store',
			itemId: 'torch',
			containerId: 'backpack',
		});
		expect(dropAction(carried, drop('Actor.h.Item.rope'), '')).toEqual({
			kind: 'takeOut',
			itemId: 'rope',
		});
	});

	it('does nothing for an object already in that place, or a container dropped on itself', () => {
		expect(dropAction(carried, drop('Actor.h.Item.rope'), 'backpack')).toEqual({ kind: 'none' });
		expect(dropAction(carried, drop('Actor.h.Item.torch'), '')).toEqual({ kind: 'none' });
		expect(dropAction(carried, drop('Actor.h.Item.backpack'), 'backpack')).toEqual({
			kind: 'none',
		});
	});

	it('shows a carried item dropped outside the Inventory, as there is no hand sorting', () => {
		expect(dropAction(carried, drop('Actor.h.Item.ignite'), null)).toEqual({
			kind: 'reveal',
			itemId: 'ignite',
			itemType: 'spell',
		});
		expect(dropAction(carried, drop('Actor.h.Item.ignite'), 'backpack')).toEqual({ kind: 'none' });
	});
});

describe('tabOfItemType', () => {
	it('sends an object to the Inventory, a spell to Spells, and all else to Features', () => {
		expect(tabOfItemType('object')).toBe('inventory');
		expect(tabOfItemType('spell')).toBe('spells');
		expect(tabOfItemType('feature')).toBe('features');
		expect(tabOfItemType(undefined)).toBe('features');
	});
});
