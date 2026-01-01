const { fields } = foundry.data;

export const metadata = () => ({
	actorName: new fields.StringField({ required: true, initial: '', nullable: false }),
	actorType: new fields.StringField({ required: true, initial: '', nullable: false }),
	image: new fields.StringField({ required: true, initial: '', nullable: false }),
	permissions: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	rollMode: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true }),
});

export const targets = () => ({
	targets: new fields.ArrayField(new fields.StringField({ required: true, nullable: false }), {
		required: true,
		nullable: false,
		initial: [],
	}),
});
