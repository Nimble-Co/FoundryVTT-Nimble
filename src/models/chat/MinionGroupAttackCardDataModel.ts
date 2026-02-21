import { metadata, targets } from './common.js';

const { fields } = foundry.data;

const minionGroupAttackRow = () =>
	new fields.ObjectField({
		required: true,
		nullable: false,
	});

const minionGroupAttackCardSchema = () => ({
	groupLabel: new fields.StringField({ required: true, nullable: false, initial: '' }),
	rows: new fields.ArrayField(minionGroupAttackRow(), {
		required: true,
		nullable: false,
		initial: [],
	}),
	skippedMembers: new fields.ArrayField(
		new fields.ObjectField({ required: true, nullable: false }),
		{
			required: true,
			nullable: false,
			initial: [],
		},
	),
	targetName: new fields.StringField({ required: true, nullable: false, initial: '' }),
	totalDamage: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 0,
		integer: true,
		min: 0,
	}),
	unsupportedWarnings: new fields.ArrayField(
		new fields.StringField({ required: true, nullable: false }),
		{
			required: true,
			nullable: false,
			initial: [],
		},
	),
});

declare namespace NimbleMinionGroupAttackCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof minionGroupAttackCardSchema> &
		ReturnType<typeof targets>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleMinionGroupAttackCardData extends foundry.abstract.TypeDataModel<
	NimbleMinionGroupAttackCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleMinionGroupAttackCardData.BaseData,
	NimbleMinionGroupAttackCardData.DerivedData
> {
	static override defineSchema(): NimbleMinionGroupAttackCardData.Schema {
		return {
			...metadata(),
			...targets(),
			...minionGroupAttackCardSchema(),
		};
	}
}

export { NimbleMinionGroupAttackCardData };
