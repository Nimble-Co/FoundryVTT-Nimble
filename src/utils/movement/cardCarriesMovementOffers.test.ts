import { describe, expect, it } from 'vitest';
import chatDataModels from '../../models/chat/chatDataModels.js';
import { cardCarriesMovementOffers } from './cardCarriesMovementOffers.js';

type Models = Parameters<typeof cardCarriesMovementOffers>[1];
const models = chatDataModels as unknown as Models;

describe('cardCarriesMovementOffers', () => {
	it('is true for exactly the card types whose data model has the field', () => {
		const carrying = Object.keys(chatDataModels).filter((type) =>
			cardCarriesMovementOffers(type, models),
		);
		expect(carrying.sort()).toEqual(['feature', 'movementOffer', 'object', 'spell']);
	});

	it('is false for a card type with no data model, and for no type', () => {
		expect(cardCarriesMovementOffers('base', models)).toBe(false);
		expect(cardCarriesMovementOffers(undefined, models)).toBe(false);
	});
});
