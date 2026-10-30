import actorDataModels from '../actorDataModels.js';

type FieldLike = { fields?: Record<string, FieldLike>; initial?: unknown; nullable?: boolean };

describe('actor currency schema', () => {
	it.each(Object.keys(actorDataModels))('%s stores gp, sp and cp as plain numbers', (type) => {
		const model = actorDataModels[type as keyof typeof actorDataModels];
		const currency = (model.defineSchema() as unknown as Record<string, FieldLike>).currency;

		expect(currency).toBeInstanceOf(foundry.data.fields.SchemaField);
		expect(Object.keys(currency.fields ?? {}).sort()).toEqual(['cp', 'gp', 'sp']);
		for (const field of Object.values(currency.fields ?? {})) {
			expect(field).toBeInstanceOf(foundry.data.fields.NumberField);
			expect(field).toMatchObject({ initial: 0, nullable: false });
		}
	});
});

describe('character Inspiration', () => {
	it('starts off: the GM grants it', () => {
		const schema = actorDataModels.character.defineSchema() as unknown as Record<string, FieldLike>;
		const inspiration = schema.resources.fields?.inspiration;

		expect(inspiration).toBeInstanceOf(foundry.data.fields.BooleanField);
		expect(inspiration).toMatchObject({ initial: false, nullable: false });
	});
});
