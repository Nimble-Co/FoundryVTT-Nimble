const { fields } = foundry.data;

const conditionSchema = () => ({
	identifier: new fields.StringField({ required: true, nullable: false, initial: '' }),
	aliases: new fields.ArrayField(
		new fields.StringField({ required: true, nullable: false, initial: '' }),
		{ required: true, nullable: false, initial: () => [] },
	),
	duration: new fields.SchemaField({
		value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	}),
	isOverlay: new fields.BooleanField({ required: true, nullable: false, initial: false }),
	references: new fields.SchemaField({
		parent: new fields.SchemaField({
			uuid: new fields.StringField({ required: true, nullable: true }),
			type: new fields.StringField({ required: true, nullable: true }),
		}),
		children: new fields.ArrayField(
			new fields.SchemaField({
				uuid: new fields.StringField({ required: true, nullable: true }),
				type: new fields.StringField({ required: true, nullable: false, initial: 'condition' }),
			}),
			{ required: true, nullable: false },
		),
	}),
});

declare namespace NimbleConditionEffectData {
	type Schema = foundry.data.fields.DataSchema & ReturnType<typeof conditionSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleConditionEffectData extends foundry.abstract.TypeDataModel<
	NimbleConditionEffectData.Schema,
	ActiveEffect,
	NimbleConditionEffectData.BaseData,
	NimbleConditionEffectData.DerivedData
> {
	static override defineSchema(): NimbleConditionEffectData.Schema {
		return {
			...conditionSchema(),
		};
	}
}

export { NimbleConditionEffectData };
