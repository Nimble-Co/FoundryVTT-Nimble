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
		hp: new fields.SchemaField({
			max: new fields.NumberField({ required: true, initial: 1, nullable: false }),
			temp: new fields.NumberField({ required: true, initial: 0, nullable: false }),
			value: new fields.NumberField({ required: true, initial: 1, nullable: false }),
		}),
		sizeCategory: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'medium',
			options: ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'],
		}),
		movement: new fields.SchemaField({
			burrow: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
				integer: true,
				min: 0,
			}),
			climb: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
				integer: true,
				min: 0,
			}),
			fly: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
				integer: true,
				min: 0,
			}),
			swim: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
				integer: true,
				min: 0,
			}),
			walk: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 6,
				integer: true,
				min: 0,
			}),
		}),
	}),
	description: new fields.HTMLField({ required: true, nullable: false, initial: '' }),
	details: new fields.SchemaField({
		creatureType: new fields.StringField({ required: true, nullable: false, initial: '' }),
		level: new fields.StringField({ required: true, nullable: false, initial: '1' }),
	}),
});

declare namespace NimbleMinionData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof attackSequence> &
		ReturnType<typeof savingThrows> &
		ReturnType<typeof MinionSchema>;
	/** Base data derived from the schema */
	type BaseData = foundry.data.fields.SchemaField.InitializedData<Schema>;
	/** Additional derived/computed data - empty for Minion */
	type DerivedData = Record<string, never>;
}

class NimbleMinionData extends foundry.abstract.TypeDataModel<
	NimbleMinionData.Schema,
	Actor,
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
