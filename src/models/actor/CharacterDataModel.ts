import { RecordField } from '../fields/RecordField.js';
import { abilities, savingThrows } from './common.js';

const { fields } = foundry.data;

/** ******************************** */
//        Skills` Schema
/** ******************************** */
type SkillSchema = foundry.data.fields.SchemaField<{
	bonus: foundry.data.fields.NumberField<{
		required: true;
		initial: 0;
		nullable: false;
		integer: true;
	}>;
	defaultRollMode: foundry.data.fields.NumberField<{
		required: true;
		initial: 0;
		nullable: false;
		integer: true;
	}>;
	mod: foundry.data.fields.NumberField<{
		required: true;
		initial: 0;
		nullable: false;
		integer: true;
	}>;
	points: foundry.data.fields.NumberField<{
		required: true;
		initial: 0;
		nullable: false;
		integer: true;
	}>;
}>;

type SkillsSchema = foundry.data.fields.SchemaField<{
	arcana: SkillSchema;
	examination: SkillSchema;
	influence: SkillSchema;
	insight: SkillSchema;
	might: SkillSchema;
	lore: SkillSchema;
	naturecraft: SkillSchema;
	perception: SkillSchema;
	finesse: SkillSchema;
	stealth: SkillSchema;
}>;

/** ******************************** */
//        Character Schema
/** ******************************** */
const characterSchema = () => ({
	attributes: new fields.SchemaField({
		armor: new fields.SchemaField({
			baseValue: new fields.StringField({
				required: true,
				initial: '@dexterity',
				nullable: false,
			}),
			components: new fields.ArrayField(
				new fields.SchemaField({
					mode: new fields.StringField({
						required: true,
						nullable: false,
						initial: 'add',
						choices: ['add', 'multiply', 'override'],
					}),
					priority: new fields.NumberField({
						required: true,
						nullable: false,
						initial: 20,
					}),
					source: new fields.StringField({
						required: true,
						initial: '',
						nullable: false,
					}),
					value: new fields.NumberField({
						required: true,
						nullable: false,
						initial: 1,
					}),
				}),
				{ required: true, nullable: false, initial: () => [] },
			),
			hint: new fields.StringField({
				required: true,
				initial: '',
				nullable: false,
			}),
			value: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
		}),
		hp: new fields.SchemaField({
			max: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
			temp: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
			value: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
		}),
		hitDice: new RecordField(
			new fields.StringField({ required: true, initial: '', nullable: false }),
			new fields.SchemaField({
				current: new fields.NumberField({
					required: true,
					nullable: false,
					initial: 0,
				}),
				origin: new fields.ArrayField(
					new fields.StringField({
						required: true,
						nullable: false,
						initial: '',
					}),
					{ required: true, nullable: false },
				),
			}),
		),
		initiative: new fields.SchemaField({
			bonuses: new fields.StringField({
				required: true,
				initial: '',
				nullable: false,
			}),
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
		wounds: new fields.SchemaField({
			bonus: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
			value: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
		}),
	}),
	classData: new fields.SchemaField({
		startingClass: new fields.StringField({
			required: true,
			nullable: true,
			initial: null,
		}),
		levels: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{ required: true, nullable: false },
		),
	}),
	currency: new fields.SchemaField({
		cp: new fields.SchemaField({
			label: new fields.StringField({
				required: true,
				nullable: false,
				initial: 'NIMBLE.currencyAbbreviations.cp',
			}),
			value: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
			}),
		}),
		sp: new fields.SchemaField({
			label: new fields.StringField({
				required: true,
				nullable: false,
				initial: 'NIMBLE.currencyAbbreviations.sp',
			}),
			value: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
			}),
		}),
		gp: new fields.SchemaField({
			label: new fields.StringField({
				required: true,
				nullable: false,
				initial: 'NIMBLE.currencyAbbreviations.gp',
			}),
			value: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
			}),
		}),
	}),
	details: new fields.SchemaField({
		age: new fields.StringField({
			required: true,
			initial: '',
			nullable: false,
		}),
		notes: new fields.HTMLField({
			required: true,
			initial: '',
			nullable: false,
		}),
		gender: new fields.StringField({
			required: true,
			initial: '',
			nullable: false,
		}),
		height: new fields.StringField({
			required: true,
			initial: '',
			nullable: false,
		}),
		weight: new fields.StringField({
			required: true,
			initial: '',
			nullable: false,
		}),
	}),
	inventory: new fields.SchemaField({
		bonusSlots: new fields.NumberField({
			required: true,
			initial: 0,
			nullable: false,
		}),
	}),
	proficiencies: new fields.SchemaField({
		armor: new fields.SetField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
		),
		languages: new fields.SetField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
		),
		weapons: new fields.ArrayField(
			new fields.StringField({ required: true, initial: '', nullable: false }),
			{ required: true, nullable: false, initial: [] },
		),
	}),
	resources: new fields.SchemaField({
		inspiration: new fields.BooleanField({
			initial: true,
			nullable: false,
			required: true,
		}),
		mana: new fields.SchemaField({
			current: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
			baseMax: new fields.NumberField({
				required: true,
				initial: 0,
				nullable: false,
			}),
		}),
	}),
	levelUpHistory: new fields.ArrayField(
		new fields.SchemaField({
			level: new fields.NumberField({
				required: true,
				initial: 1,
				integer: true,
				nullable: false,
			}),
			hpIncrease: new fields.NumberField({
				required: true,
				initial: 0,
				integer: true,
				nullable: false,
			}),
			abilityIncreases: new RecordField(
				new fields.StringField({ required: true, initial: '', nullable: false }),
				new fields.NumberField({ required: true, initial: 0, integer: true, nullable: false }),
			),
			skillIncreases: new RecordField(
				new fields.StringField({ required: true, initial: '', nullable: false }),
				new fields.NumberField({ required: true, initial: 0, integer: true, nullable: false }),
			),
			hitDieAdded: new fields.BooleanField({
				required: true,
				initial: false,
				nullable: false,
			}),
			classIdentifier: new fields.StringField({
				required: true,
				initial: '',
				nullable: false,
			}),
		}),
		{ required: true, nullable: false, initial: () => [] },
	),
	skills: new fields.SchemaField(
		Object.keys(CONFIG.NIMBLE.skills ?? {}).reduce((skills, skillKey) => {
			skills[skillKey] = new fields.SchemaField({
				bonus: new fields.NumberField({
					required: true,
					nullable: false,
					integer: true,
					initial: 0,
				}),
				defaultRollMode: new fields.NumberField({
					required: true,
					nullable: false,
					integer: true,
					initial: 0,
				}),
				mod: new fields.NumberField({
					required: true,
					initial: 0,
					integer: true,
					nullable: false,
				}),
				points: new fields.NumberField({
					required: true,
					initial: 0,
					integer: true,
					nullable: false,
				}),
			});

			return skills;
		}, {}),
	) as unknown as SkillsSchema,
});

declare namespace NimbleCharacterData {
	type Schema = DataSchema &
		ReturnType<typeof abilities> &
		ReturnType<typeof savingThrows> &
		ReturnType<typeof characterSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {
		attributes: {
			initiative: {
				mod: number;
			};
			wounds: {
				max: number;
			};
		};
		inventory: {
			totalSlots: number;
			usedSlots: number;
		};
	}
}

class NimbleCharacterData extends foundry.abstract.TypeDataModel<
	NimbleCharacterData.Schema,
	Actor.ConfiguredInstance,
	NimbleCharacterData.BaseData,
	NimbleCharacterData.DerivedData
> {
	static override defineSchema(): NimbleCharacterData.Schema {
		return {
			...characterSchema(),
			...abilities(),
			...savingThrows(),
		};
	}

	// This is necessary to ensure that derived data is included in the toObject data.
	override toObject(source: true): this['_source'];
	override toObject(source?: boolean): ReturnType<this['schema']['toObject']>;
	override toObject(source?: boolean): this['_source'] | ReturnType<this['schema']['toObject']> {
		const data = super.toObject(source);
		data.inventory = foundry.utils.mergeObject(data.inventory, this.inventory);

		data.attributes.initiative = foundry.utils.mergeObject(
			data.attributes.initiative,
			this.attributes.initiative,
		);

		data.attributes.wounds = foundry.utils.mergeObject(
			data.attributes.wounds,
			this.attributes.wounds,
		);

		return data;
	}
}

export { NimbleCharacterData };
