import { metadata } from './common.js';

const { fields } = foundry.data;

const moveActionCardSchema = () => ({
	speed: new fields.NumberField({ required: true, initial: 0, nullable: false }),
});

declare namespace NimbleMoveActionCardData {
	type Schema = DataSchema & ReturnType<typeof metadata> & ReturnType<typeof moveActionCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleMoveActionCardData extends foundry.abstract.TypeDataModel<
	NimbleMoveActionCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleMoveActionCardData.BaseData,
	NimbleMoveActionCardData.DerivedData
> {
	static override defineSchema(): NimbleMoveActionCardData.Schema {
		return {
			...moveActionCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleMoveActionCardData };
