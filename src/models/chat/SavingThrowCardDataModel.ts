import { metadata } from './common.js';

const { fields } = foundry.data;

const savingThrowCardSchema = () => ({
	saveKey: new fields.StringField({ required: true, initial: '', nullable: false }),
	rollMode: new fields.NumberField({ required: true, initial: 0, nullable: false }),
});

declare namespace NimbleSavingThrowCardData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof savingThrowCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSavingThrowCardData extends foundry.abstract.TypeDataModel<
	NimbleSavingThrowCardData.Schema,
	ChatMessage,
	NimbleSavingThrowCardData.BaseData,
	NimbleSavingThrowCardData.DerivedData
> {
	static override defineSchema(): NimbleSavingThrowCardData.Schema {
		return {
			...savingThrowCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleSavingThrowCardData };
