/** The "Only attacks made through" field: an item identifier. Blank is every attack. */
export function attackOriginField() {
	return new foundry.data.fields.StringField({
		required: true,
		nullable: false,
		initial: '',
		label: 'NIMBLE.rules.attackOrigin.label',
		hint: 'NIMBLE.rules.attackOrigin.hint',
	});
}
