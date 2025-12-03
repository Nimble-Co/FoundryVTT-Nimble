const { fields } = foundry.data;

const nimbleNPCCombatantSchema = () => ({
	sort: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
});

declare namespace NimbleNPCCombatantData {
	type Schema = foundry.data.fields.DataSchema & ReturnType<typeof nimbleNPCCombatantSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleNPCCombatantData extends foundry.abstract.TypeDataModel<
	NimbleNPCCombatantData.Schema,
	Combatant,
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
