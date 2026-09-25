import { describe, expect, it } from 'vitest';
import chatDataModels from './chatDataModels.js';

type SchemaModel = { defineSchema(): Record<string, unknown> };

function schemaKeys(type: string): string[] {
	const model = (chatDataModels as unknown as Record<string, SchemaModel | undefined>)[type];
	expect(model).toBeDefined();
	return Object.keys(model!.defineSchema()).sort();
}

function movementTriggerSchema(): Record<string, unknown> {
	const model = (chatDataModels as unknown as Record<string, SchemaModel>).movementTrigger;
	return model.defineSchema();
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

	it('lets a movementTrigger card be a use card or a reminder, a use card by default', () => {
		const payload = movementTriggerSchema().payload as { choices: string[]; initial: string };
		expect(payload.choices).toEqual(['use', 'reminder']);
		expect(payload.initial).toBe('use');
	});

	it('keeps movementTrigger distances at zero or more, with spacesThisTurn unknown by default', () => {
		type NumberOptions = { min?: number; nullable?: boolean; initial?: number | null };
		const schema = movementTriggerSchema();
		const spaces = schema.spaces as NumberOptions;
		const spacesThisTurn = schema.spacesThisTurn as NumberOptions;

		expect(spaces.min).toBe(0);
		expect(spacesThisTurn.min).toBe(0);
		expect(spacesThisTurn.nullable).toBe(true);
		expect(spacesThisTurn.initial).toBeNull();
	});
});
