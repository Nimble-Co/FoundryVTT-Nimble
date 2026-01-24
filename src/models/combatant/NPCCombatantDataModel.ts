const { fields } = foundry.data;

const nimbleNPCCombatantSchema = () => ({
	sort: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	actions: new fields.SchemaField({
		base: new fields.SchemaField({
			current: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
				integer: true,
				min: 0,
			}),
			max: new fields.NumberField({
				required: true,
				initial: 1,
				nullable: false,
				integer: true,
				min: 0,
			}),
		}),
	}),
});

declare namespace NimbleNPCCombatantData {
	type Schema = DataSchema & ReturnType<typeof nimbleNPCCombatantSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleNPCCombatantData extends foundry.abstract.TypeDataModel<
	NimbleNPCCombatantData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleNPCCombatantData.BaseData,
	NimbleNPCCombatantData.DerivedData
> {
	static override defineSchema(): NimbleNPCCombatantData.Schema {
		return {
			...nimbleNPCCombatantSchema(),
		};
	}
}

export { NimbleNPCCombatantData };
