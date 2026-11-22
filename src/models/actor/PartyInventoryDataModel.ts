const { fields } = foundry.data;

/** Hit points stay at zero so actor preparation can read them. This is not a creature. */
const partyInventorySchema = () => ({
	attributes: new fields.SchemaField({
		hp: new fields.SchemaField({
			max: new fields.NumberField({ required: true, initial: 0, nullable: false, integer: true }),
			temp: new fields.NumberField({ required: true, initial: 0, nullable: false, integer: true }),
			value: new fields.NumberField({ required: true, initial: 0, nullable: false, integer: true }),
		}),
	}),
});

declare namespace NimblePartyInventoryData {
	type Schema = ReturnType<typeof partyInventorySchema>;

	interface BaseData extends Record<string, any> {}

	interface DerivedData extends Record<string, any> {}
}

class NimblePartyInventoryData extends foundry.abstract.TypeDataModel<
	NimblePartyInventoryData.Schema,
	Actor.ConfiguredInstance,
	NimblePartyInventoryData.BaseData,
	NimblePartyInventoryData.DerivedData
> {
	static override defineSchema(): NimblePartyInventoryData.Schema {
		return partyInventorySchema();
	}
}

export { NimblePartyInventoryData };
