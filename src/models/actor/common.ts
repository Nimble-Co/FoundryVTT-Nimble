const { fields } = foundry.data;

/** ******************************** */
//        Abilities Schema
/** ******************************** */
type AbilitySchema = foundry.data.fields.SchemaField<{
	baseValue: foundry.data.fields.NumberField<{
		required: true;
		initial: 0;
		nullable: false;
		integer: true;
		max: 12;
	}>;
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
}>;

type AbilitiesSchema = foundry.data.fields.SchemaField<{
	strength: AbilitySchema;
	dexterity: AbilitySchema;
	intelligence: AbilitySchema;
	will: AbilitySchema;
}>;

export const abilities = () => ({
	abilities: new fields.SchemaField(
		Object.keys(CONFIG.NIMBLE.abilityScores ?? {}).reduce((abilityScores, abilityKey) => {
			abilityScores[abilityKey] = new fields.SchemaField({
				baseValue: new fields.NumberField({
					required: true,
					initial: 0,
					integer: true,
					nullable: false,
					max: 12,
				}),
				bonus: new fields.NumberField({
					required: true,
					initial: 0,
					integer: true,
					nullable: false,
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
			});

			return abilityScores;
		}, {}),
	) as unknown as AbilitiesSchema,
});

/** ******************************** */
//        Saving Throws Schema
/** ******************************** */
type SavingThrowSchema = foundry.data.fields.SchemaField<{
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
}>;

type SavingThrowsSchema = foundry.data.fields.SchemaField<{
	strength: SavingThrowSchema;
	dexterity: SavingThrowSchema;
	intelligence: SavingThrowSchema;
	will: SavingThrowSchema;
}>;

export const savingThrows = () => ({
	savingThrows: new fields.SchemaField(
		Object.keys(CONFIG.NIMBLE.savingThrows ?? {}).reduce((saves, saveKey) => {
			saves[saveKey] = new fields.SchemaField({
				bonus: new fields.NumberField({
					required: true,
					initial: 0,
					integer: true,
					nullable: false,
				}),
				defaultRollMode: new fields.NumberField({
					required: true,
					initial: 0,
					integer: true,
					min: -3,
					max: 3,
					nullable: false,
				}),
				mod: new fields.NumberField({
					required: true,
					initial: 0,
					integer: true,
					nullable: false,
				}),
			});

			return saves;
		}, {}),
	) as unknown as SavingThrowsSchema,
});

/** ******************************** */
//      Attack Sequence Schema
/** ******************************** */

type AttackSequenceSchema = foundry.data.fields.HTMLField<{
	required: true;
	nullable: false;
	initial: '';
}>;

export const attackSequence = () => ({
	attackSequence: new fields.HTMLField({
		required: true,
		nullable: false,
		initial: '',
	}) as AttackSequenceSchema,
});
