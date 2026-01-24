const { fields } = foundry.data;

const nimbleSoloMonsterCombatantSchema = () => ({
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

declare namespace NimbleSoloMonsterCombatantData {
	type Schema = DataSchema & ReturnType<typeof nimbleSoloMonsterCombatantSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSoloMonsterCombatantData extends foundry.abstract.TypeDataModel<
	NimbleSoloMonsterCombatantData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleSoloMonsterCombatantData.BaseData,
	NimbleSoloMonsterCombatantData.DerivedData
> {
	static override defineSchema(): NimbleSoloMonsterCombatantData.Schema {
		return {
			...nimbleSoloMonsterCombatantSchema(),
		};
	}
}

export { NimbleSoloMonsterCombatantData };
