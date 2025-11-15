import { attackSequence, savingThrows } from './common';

const { fields } = foundry.data;

/** ******************************** */
//            Solo Monster Schema
/** ******************************** */
const soloMonsterSchema = () => ({
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
			max: new fields.NumberField({ required: true, initial: 10, nullable: false }),
			temp: new fields.NumberField({ required: true, initial: 0, nullable: false }),
			value: new fields.NumberField({ required: true, initial: 10, nullable: false }),
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
	bloodiedEffect: new fields.SchemaField({
		description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	}),
	lastStandEffect: new fields.SchemaField({
		description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	}),
});

declare namespace NimbleSoloMonsterData {
	type Schema = DataSchema & ReturnType<typeof savingThrows> & ReturnType<typeof soloMonsterSchema>;

	interface BaseData extends Record<string, any> {}

	interface DerivedData extends Record<string, any> {}
}

class NimbleSoloMonsterData extends foundry.abstract.TypeDataModel<
	NimbleSoloMonsterData.Schema,
	Actor.ConfiguredInstance,
	NimbleSoloMonsterData.BaseData,
	NimbleSoloMonsterData.DerivedData
> {
	static override defineSchema(): NimbleSoloMonsterData.Schema {
		return {
			...soloMonsterSchema(),
			...attackSequence(),
			...savingThrows(),
		};
	}
}

export { NimbleSoloMonsterData };
