import { attackSequence, savingThrows } from './common.js';

const { fields } = foundry.data;

/** ******************************** */
//            Solo Monster Schema
/** ******************************** */
const MinionSchema = () => ({
	attributes: new fields.SchemaField({
		armor: new fields.StringField({ required: true, nullable: false, initial: 'none' }),
		damageResistances: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false }),
			{ required: true, nullable: false, initial: [] },
		),
		damageVulnerabilities: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false }),
			{ required: true, nullable: false, initial: [] },
		),
		damageImmunities: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false }),
			{ required: true, nullable: false, initial: [] },
		),
		sizeCategory: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'medium',
			options: ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'],
		}),
	}),
	description: new fields.HTMLField({ required: true, nullable: false, initial: '' }),
	details: new fields.SchemaField({
		creatureType: new fields.StringField({ required: true, nullable: false, initial: '' }),
		level: new fields.StringField({ required: true, nullable: false, initial: '1' }),
	}),
});

declare namespace NimbleMinionData {
	type Schema = DataSchema & ReturnType<typeof savingThrows> & ReturnType<typeof MinionSchema>;

	interface BaseData extends Record<string, any> {}

	interface DerivedData extends Record<string, any> {}
}

class NimbleMinionData extends foundry.abstract.TypeDataModel<
	NimbleMinionData.Schema,
	Actor.ConfiguredInstance,
	NimbleMinionData.BaseData,
	NimbleMinionData.DerivedData
> {
	static override defineSchema(): NimbleMinionData.Schema {
		return {
			...MinionSchema(),
			...attackSequence(),
			...savingThrows(),
		};
	}
}

export { NimbleMinionData };
