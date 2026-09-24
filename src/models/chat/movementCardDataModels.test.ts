import { describe, expect, it } from 'vitest';
import chatDataModels from './chatDataModels.js';

type SchemaModel = { defineSchema(): Record<string, unknown> };

function schemaKeys(type: string): string[] {
	const model = (chatDataModels as unknown as Record<string, SchemaModel | undefined>)[type];
	expect(model).toBeDefined();
	return Object.keys(model!.defineSchema()).sort();
}

describe('movement chat card data models', () => {
	it('registers movementOffer with the card metadata, targets, offers and one effect list', () => {
		expect(schemaKeys('movementOffer')).toEqual(
			[
				'actorName',
				'actorType',
				'image',
				'permissions',
				'rollMode',
				'targets',
				'movementOffers',
				'name',
				'reason',
				'activation',
			].sort(),
		);
	});

	it('registers movementTrigger with the trigger fields', () => {
		expect(schemaKeys('movementTrigger')).toEqual(
			[
				'actorName',
				'actorType',
				'image',
				'permissions',
				'rollMode',
				'targets',
				'name',
				'itemUuid',
				'payload',
				'message',
				'moverName',
				'spaces',
				'spacesThisTurn',
			].sort(),
		);
	});
});
