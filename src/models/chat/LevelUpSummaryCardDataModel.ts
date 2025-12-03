import { activation } from '../item/common.js';
import { metadata } from './common.js';

const { fields } = foundry.data;

const levelUpSummaryCardSchema = () => ({
	currentClassLevel: new fields.NumberField({ required: true, initial: 1, nullable: false }),
	takeAverageHp: new fields.BooleanField({ required: true, initial: false, nullable: false }),
});

declare namespace NimbleLevelUpSummaryCardData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof activation> &
		ReturnType<typeof metadata> &
		ReturnType<typeof levelUpSummaryCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleLevelUpSummaryCardData extends foundry.abstract.TypeDataModel<
	NimbleLevelUpSummaryCardData.Schema,
	ChatMessage,
	NimbleLevelUpSummaryCardData.BaseData,
	NimbleLevelUpSummaryCardData.DerivedData
> {
	static override defineSchema(): NimbleLevelUpSummaryCardData.Schema {
		return {
			...activation(),
			...levelUpSummaryCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleLevelUpSummaryCardData };
