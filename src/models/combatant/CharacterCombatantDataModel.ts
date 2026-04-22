const { fields } = foundry.data;

const nimbleCharacterCombatantSchema = () => ({
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
				initial: 3,
				nullable: false,
				integer: true,
				min: 0,
			}),
			bonus: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
				integer: true,
				min: 0,
			}),
		}),
		heroic: new fields.SchemaField({
			interposeAvailable: new fields.BooleanField({
				required: true,
				initial: true,
				nullable: false,
			}),
			defendAvailable: new fields.BooleanField({
				required: true,
				initial: true,
				nullable: false,
			}),
			opportunityAttackAvailable: new fields.BooleanField({
				required: true,
				initial: true,
				nullable: false,
			}),
			helpAvailable: new fields.BooleanField({
				required: true,
				initial: true,
				nullable: false,
			}),
		}),
	}),
	sort: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
});

declare namespace NimbleCharacterCombatantData {
	type Schema = DataSchema & ReturnType<typeof nimbleCharacterCombatantSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleCharacterCombatantData extends foundry.abstract.TypeDataModel<
	NimbleCharacterCombatantData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleCharacterCombatantData.BaseData,
	NimbleCharacterCombatantData.DerivedData
> {
	static override defineSchema(): NimbleCharacterCombatantData.Schema {
		return {
			...nimbleCharacterCombatantSchema(),
		};
	}
}

export { NimbleCharacterCombatantData };
