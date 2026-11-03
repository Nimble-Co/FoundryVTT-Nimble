import {
	checkDC,
	incomingReactions,
	metadata,
	migrateIncomingReactions,
	rerollHistory,
	resultChanges,
	roller,
} from './common.js';

const { fields } = foundry.data;

const savingThrowCardSchema = () => ({
	saveKey: new fields.StringField({ required: true, initial: '', nullable: false }),
	rollMode: new fields.NumberField({ required: true, initial: 0, nullable: false }),
	// The last result the saveResolved hook told, so a reload or a later write does not tell it again.
	reportedSaveResult: new fields.StringField({
		required: false,
		nullable: true,
		initial: null,
		choices: ['failed', 'succeeded'],
	}),
});

declare namespace NimbleSavingThrowCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof savingThrowCardSchema> &
		ReturnType<typeof roller> &
		ReturnType<typeof checkDC> &
		ReturnType<typeof incomingReactions> &
		ReturnType<typeof rerollHistory> &
		ReturnType<typeof resultChanges>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSavingThrowCardData extends foundry.abstract.TypeDataModel<
	NimbleSavingThrowCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleSavingThrowCardData.BaseData,
	NimbleSavingThrowCardData.DerivedData
> {
	static override defineSchema(): NimbleSavingThrowCardData.Schema {
		return {
			...savingThrowCardSchema(),
			...metadata(),
			...roller(),
			...checkDC(),
			...incomingReactions(),
			...rerollHistory(),
			...resultChanges(),
		};
	}

	static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
		migrateIncomingReactions(source);
		return super.migrateData(source);
	}
}

export { NimbleSavingThrowCardData };
