const { fields } = foundry.data;

/**
 * AE V2 (Foundry V14) moved the document-level `changes` array into the type
 * data model: every ActiveEffect TypeDataModel must define a core-compatible
 * `changes` field or Game##verifyActiveEffectModels errors at world load and
 * force-extends the schema. This mirrors foundry.data.ActiveEffectTypeDataModel's
 * schema (that base class is not yet typed by fvtt-types); the verifier
 * requires an ArrayField of SchemaFields with string `type`/`phase` and
 * numeric `priority`. Nimble conditions carry no stat changes, so the array
 * simply stays empty.
 */
const changesSchema = () => ({
	changes: new fields.ArrayField(
		new fields.SchemaField({
			key: new fields.StringField({ required: true }),
			type: new fields.StringField({ required: true, blank: false, initial: 'add' }),
			value: new fields.AnyField({ required: true, nullable: true, initial: '' }),
			phase: new fields.StringField({ required: true, blank: false, initial: 'initial' }),
			priority: new fields.NumberField(),
		}),
	),
});

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
	type Schema = DataSchema & ReturnType<typeof conditionSchema> & ReturnType<typeof changesSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleConditionEffectData extends foundry.abstract.TypeDataModel<
	NimbleConditionEffectData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleConditionEffectData.BaseData,
	NimbleConditionEffectData.DerivedData
> {
	static override defineSchema(): NimbleConditionEffectData.Schema {
		return {
			...changesSchema(),
			...conditionSchema(),
		};
	}
}

export { NimbleConditionEffectData };
