import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { askedByOf, saveFromCardOptions } from '../saveFromCard.js';

const card = (itemUuid?: string) => ({
	id: 'card1',
	flags: itemUuid ? { [SYSTEM_ID]: { itemUuid } } : {},
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('saveFromCardOptions', () => {
	it('tags the save with the item, by its identifier or else its name, and names the step', () => {
		const items: Record<string, object> = {
			'Item.hulk': { name: 'Confounding Pheromones.', system: { identifier: '' } },
			'Item.allure': { name: 'Infernal Allure', system: { identifier: 'allure' } },
		};
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => items[uuid] ?? null),
		);

		expect(saveFromCardOptions(card('Item.hulk'), 'save1')).toEqual({
			cardFlags: { askedBy: { cardId: 'card1', nodeId: 'save1' } },
			rollTags: ['save:from', 'save:from:confounding-pheromones'],
		});
		expect(saveFromCardOptions(card('Item.allure'), 'save1').rollTags).toEqual([
			'save:from',
			'save:from:allure',
		]);
	});

	it('has only the general tag when the card has no item', () => {
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => null),
		);

		expect(saveFromCardOptions(card(), 'save1').rollTags).toEqual(['save:from']);
		expect(saveFromCardOptions({ flags: {} }, 'save1')).toEqual({ rollTags: ['save:from'] });
	});
});

describe('askedByOf', () => {
	it('reads the step that asked for the save, and nothing from another save card', () => {
		const asked = { cardId: 'card1', nodeId: 'save1' };

		expect(askedByOf({ flags: { [SYSTEM_ID]: { askedBy: asked } } })).toEqual(asked);
		expect(askedByOf({ flags: {} })).toBeNull();
		expect(askedByOf(null)).toBeNull();
	});
});
