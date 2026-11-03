import { describe, expect, it } from 'vitest';
import chatDataModels from '../../../models/chat/chatDataModels.js';
import { type CardDataModels, cardSchemaHas } from '../cardSchemaHas.js';

const models = chatDataModels as unknown as CardDataModels;

describe('cardSchemaHas', () => {
	it('is true for a card type whose data model has the field', () => {
		expect(cardSchemaHas('feature', 'incomingReactions', models)).toBe(true);
		expect(cardSchemaHas('feature', 'movementOffers', models)).toBe(true);
	});

	it('is false for a field the data model does not have', () => {
		expect(cardSchemaHas('feature', 'noSuchField', models)).toBe(false);
	});

	it('is false for a card type with no data model, and for no type', () => {
		expect(cardSchemaHas('base', 'incomingReactions', models)).toBe(false);
		expect(cardSchemaHas(undefined, 'incomingReactions', models)).toBe(false);
	});
});
