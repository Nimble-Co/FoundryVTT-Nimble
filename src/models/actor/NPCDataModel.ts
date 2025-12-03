import { attackSequence, savingThrows } from './common.js';

const { fields } = foundry.data;

/** ******************************** */
//            Solo Monster Schema
/** ******************************** */
const NPCSchema = () => ({
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
		isFlunky: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		level: new fields.StringField({ required: true, nullable: false, initial: '1' }),
	}),
});

declare namespace NimbleNPCData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof attackSequence> &
		ReturnType<typeof savingThrows> &
		ReturnType<typeof NPCSchema>;
	/** Base data derived from the schema */
	type BaseData = foundry.data.fields.SchemaField.InitializedData<Schema>;
	/** Additional derived/computed data - empty for NPC */
	type DerivedData = Record<string, never>;
}

class NimbleNPCData extends foundry.abstract.TypeDataModel<
	NimbleNPCData.Schema,
	Actor,
	NimbleNPCData.BaseData,
	NimbleNPCData.DerivedData
> {
	static override defineSchema(): NimbleNPCData.Schema {
		return {
			...NPCSchema(),
			...attackSequence(),
			...savingThrows(),
		};
	}
}

export { NimbleNPCData };
