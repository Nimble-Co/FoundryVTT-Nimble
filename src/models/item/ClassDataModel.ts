import { NimbleBaseItemData } from './BaseItemDataModel';

const { fields } = foundry.data;

const abilityScoreSchema = (statIncreaseType) =>
	new fields.SchemaField({
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'statIncrease',
			choices: ['statIncrease', 'boon'],
		}),
		statIncreaseType: new fields.StringField({
			required: true,
			nullable: false,
			initial: statIncreaseType,
			choices: ['primary', 'secondary', 'capstone'],
		}),
	});

const schema = () => ({
	armorProficiencies: new fields.ArrayField(
		new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			options: ['cloth', 'leader', 'mail', 'plate', 'shield'],
		}),
		{ required: true, initial: [], nullable: false },
	),
	classLevel: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 1,
		integer: true,
		min: 1,
	}),
	complexity: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 1,
		integer: true,
		options: [1, 2, 3],
	}),
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	groupIdentifiers: new fields.ArrayField(
		new fields.StringField({ required: true, initial: '', nullable: false }),
		{ required: true, initial: [], nullable: false },
	),
	keyAbilityScores: new fields.ArrayField(
		new fields.StringField({ required: true, initial: '', nullable: false }),
		{ required: true, initial: [], nullable: false },
	),
	hitDieSize: new fields.NumberField({
		required: true,
		initial: 6,
		min: 4,
		max: 12,
		nullable: false,
		integer: true,
		options: [4, 6, 8, 10, 12],
	}),
	hpData: new fields.ArrayField(
		new fields.NumberField({ required: true, initial: 0, nullable: false }),
		{ required: true, nullable: false },
	),
	savingThrows: new fields.SchemaField({
		advantage: new fields.StringField({ required: true, initial: '', nullable: false }),
		disadvantage: new fields.StringField({ required: true, initial: '', nullable: false }),
	}),
	abilityScoreData: new fields.SchemaField({
		4: abilityScoreSchema('primary'),
		5: abilityScoreSchema('secondary'),
		8: abilityScoreSchema('primary'),
		9: abilityScoreSchema('secondary'),
		12: abilityScoreSchema('primary'),
		13: abilityScoreSchema('secondary'),
		16: abilityScoreSchema('primary'),
		17: abilityScoreSchema('secondary'),
		20: abilityScoreSchema('capstone'),
	}),
	mana: new fields.SchemaField({
		formula: new fields.StringField({ required: true, initial: '', nullable: false }),
		recovery: new fields.StringField({ required: true, initial: 'safeRest', nullable: false }),
	}),
	resources: new fields.ArrayField(new fields.ObjectField({ required: true, nullable: false }), {
		required: true,
		nullable: false,
	}),
	weaponProficiencies: new fields.ArrayField(
		new fields.StringField({ required: true, initial: '', nullable: false }),
		{ required: true, nullable: false, initial: [] },
	),
});

declare namespace NimbleClassData {
	type Schema = NimbleBaseItemData.Schema & ReturnType<typeof schema>;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleClassData extends NimbleBaseItemData<
	NimbleClassData.Schema,
	NimbleClassData.BaseData,
	NimbleClassData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleClassData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema(),
		};
	}
}

export { NimbleClassData };
