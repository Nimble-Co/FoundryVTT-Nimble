const { fields } = foundry.data;

export const rules = () => ({
	rules: new fields.ArrayField(new fields.ObjectField({ required: true, nullable: false })),
});

export const activation = () => ({
	activation: new fields.SchemaField({
		acquireTargetsFromTemplate: new fields.BooleanField({
			required: true,
			initial: false,
			nullable: false,
		}),
		cost: new fields.SchemaField({
			details: new fields.StringField({
				required: true,
				initial: '',
				nullable: false,
			}),
			quantity: new fields.NumberField({
				required: true,
				initial: 1,
				nullable: false,
				min: 1,
				integer: true,
			}),
			type: new fields.StringField({
				required: true,
				initial: 'none',
				nullable: false,
			}),
			isReaction: new fields.BooleanField({
				required: true,
				initial: false,
				nullable: false,
			}),
		}),
		duration: new fields.SchemaField({
			details: new fields.StringField({
				required: true,
				initial: '',
				nullable: false,
			}),
			quantity: new fields.NumberField({
				required: true,
				initial: 1,
				nullable: false,
				min: 1,
				integer: true,
			}),
			type: new fields.StringField({
				required: true,
				initial: 'none',
				nullable: false,
			}),
		}),
		effects: new fields.ArrayField(new fields.ObjectField(), {
			required: true,
			initial: [],
			nullable: false,
		}),
		showDescription: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: true,
		}),
		targets: new fields.SchemaField({
			count: new fields.NumberField({
				required: true,
				initial: 1,
				nullable: false,
				min: 1,
				integer: true,
			}),
			restrictions: new fields.StringField({
				required: true,
				initial: '',
				nullable: false,
			}),
			attackType: new fields.StringField({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				choices: ['', 'reach', 'range'],
			}),
			distance: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 1,
				min: 1,
				integer: true,
			}),
		}),
		template: new fields.SchemaField({
			length: new fields.NumberField({
				required: true,
				initial: 1,
				nullable: false,
				min: 1,
				integer: true,
			}),
			radius: new fields.NumberField({
				required: true,
				initial: 1,
				nullable: false,
				min: 1,
				integer: true,
			}),
			shape: new fields.StringField({
				required: true,
				initial: '',
				nullable: false,
				options: ['circle', 'cone', 'emanation', 'line', 'square'],
			}),
			width: new fields.NumberField({
				required: true,
				initial: 1,
				nullable: false,
				min: 1,
				integer: true,
			}),
		}),
	}),
});

export const baseProperties = () => ({
	range: new fields.SchemaField({
		min: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 2,
		}),
		max: new fields.NumberField({
			required: true,
			nullable: true,
			initial: null,
		}),
	}),
	reach: new fields.SchemaField({
		min: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 1,
		}),
		max: new fields.NumberField({
			required: true,
			nullable: true,
			initial: null,
		}),
	}),
});
