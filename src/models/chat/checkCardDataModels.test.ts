import { describe, expect, it } from 'vitest';
import chatDataModels from './chatDataModels.js';

type Field = { options: { required?: boolean; nullable?: boolean; initial?: unknown } };

const CHECK_CARD_TYPES = ['savingThrow', 'skillCheck', 'abilityCheck'] as const;

function schemaOf(type: (typeof CHECK_CARD_TYPES)[number]) {
	return chatDataModels[type].defineSchema() as unknown as Record<string, Field>;
}

describe('check card reroll fields', () => {
	it.each(CHECK_CARD_TYPES)('%s cards store the roller, entries, history and roll mode', (type) => {
		const schema = schemaOf(type);

		expect(Object.keys(schema)).toEqual(
			expect.arrayContaining([
				'actorUuid',
				'tokenUuid',
				'incomingReactions',
				'rerolls',
				'rollMode',
			]),
		);
	});

	it.each(CHECK_CARD_TYPES)('%s cards posted before the fields load with nothing', (type) => {
		const schema = schemaOf(type);

		expect(schema.actorUuid.options).toMatchObject({ nullable: true, initial: null });
		expect(schema.tokenUuid.options).toMatchObject({ nullable: true, initial: null });
		expect(schema.actorUuid.options.required).not.toBe(true);
		expect(schema.tokenUuid.options.required).not.toBe(true);
		expect(schema.incomingReactions.options.initial).toEqual([]);
		expect(schema.rerolls.options.initial).toEqual([]);
	});
});
