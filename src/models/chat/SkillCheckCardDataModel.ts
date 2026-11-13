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

const skillCheckCardSchema = () => ({
	skillKey: new fields.StringField({ required: true, initial: '', nullable: false }),
	rollMode: new fields.NumberField({
		required: true,
		initial: 0,
		nullable: false,
		integer: true,
	}),
	// The last result the skillCheckResolved hook told, so a reload or a later write does not tell it again.
	reportedCheckResult: new fields.StringField({
		required: false,
		nullable: true,
		initial: null,
		choices: ['failed', 'succeeded'],
	}),
});

declare namespace NimbleSkillCheckCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof skillCheckCardSchema> &
		ReturnType<typeof roller> &
		ReturnType<typeof checkDC> &
		ReturnType<typeof incomingReactions> &
		ReturnType<typeof rerollHistory> &
		ReturnType<typeof resultChanges>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSkillCheckCardData extends foundry.abstract.TypeDataModel<
	NimbleSkillCheckCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleSkillCheckCardData.BaseData,
	NimbleSkillCheckCardData.DerivedData
> {
	static override defineSchema(): NimbleSkillCheckCardData.Schema {
		return {
			...skillCheckCardSchema(),
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

export { NimbleSkillCheckCardData };
