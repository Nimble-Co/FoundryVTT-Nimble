import { metadata } from './common.js';

const { fields } = foundry.data;

const chargeAdjustmentCardSchema = () => ({
	pools: new fields.ArrayField(
		new fields.ObjectField({
			required: true,
			nullable: false,
			initial: {},
			model: {
				label: new fields.StringField({ required: true }),
				previousValue: new fields.NumberField({ required: true }),
				newValue: new fields.NumberField({ required: true }),
				icon: new fields.StringField({ required: false }),
			},
		}),
		{ required: true, nullable: false, initial: [] },
	),
	itemName: new fields.StringField({ required: true }),
});

declare namespace NimbleChargeAdjustmentCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof chargeAdjustmentCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleChargeAdjustmentCardData extends foundry.abstract.TypeDataModel<
	NimbleChargeAdjustmentCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleChargeAdjustmentCardData.BaseData,
	NimbleChargeAdjustmentCardData.DerivedData
> {
	static override defineSchema(): NimbleChargeAdjustmentCardData.Schema {
		return {
			...chargeAdjustmentCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleChargeAdjustmentCardData };
