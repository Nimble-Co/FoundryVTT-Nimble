import { describe, expect, it } from 'vitest';
import { dragDataOf, droppedItemData, mayDrag } from '../drag.ts';

describe('mayDrag', () => {
	it('lets a mouse or a pen drag in all modes', () => {
		for (const pointer of ['mouse', 'pen']) {
			expect(mayDrag(pointer, false)).toBe(true);
			expect(mayDrag(pointer, true)).toBe(true);
		}
	});

	it('lets a finger drag only in edit mode', () => {
		expect(mayDrag('touch', false)).toBe(false);
		expect(mayDrag('touch', true)).toBe(true);
	});

	it('lets a drag with no pointer down go, as a keyboard or a test does', () => {
		expect(mayDrag(null, false)).toBe(true);
	});
});

describe('dragDataOf', () => {
	it('gives the Foundry drag data of an item', () => {
		expect(dragDataOf({ kind: 'item', uuid: 'Actor.a.Item.b' })).toEqual({
			type: 'Item',
			uuid: 'Actor.a.Item.b',
		});
	});

	it('gives the HeroicAction data that a hotbar drop makes into a macro', () => {
		expect(
			dragDataOf({ kind: 'heroicAction', actionId: 'move', actionType: 'action', name: 'Move' }),
		).toEqual({ type: 'HeroicAction', actionId: 'move', actionType: 'action', name: 'Move' });
	});
});

describe('droppedItemData', () => {
	const transfer = (text: string) => ({
		getData: (type: string) => (type === 'text/plain' ? text : ''),
	});

	it('reads the Foundry drag data of an item', () => {
		expect(droppedItemData(transfer('{"type":"Item","uuid":"Compendium.x.Item.y"}'))).toEqual({
			type: 'Item',
			uuid: 'Compendium.x.Item.y',
		});
	});

	it('gives null for other drag data, text that is not JSON, or no data', () => {
		expect(droppedItemData(transfer('{"type":"ActiveEffect","uuid":"a"}'))).toBeNull();
		expect(droppedItemData(transfer('Longsword'))).toBeNull();
		expect(droppedItemData(null)).toBeNull();
	});
});
