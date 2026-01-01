interface FormulaFieldOptions extends foundry.data.fields.StringField.Options {
	deterministic?: boolean | undefined;
}

class FormulaField extends foundry.data.fields.StringField {
	/**
	 * Is this formula deterministic?
	 * @defaultValue `false`
	 */
	deterministic: boolean;

	constructor(options?: FormulaFieldOptions) {
		super(options as foundry.data.fields.StringField.DefaultOptions);

		this.deterministic = options?.deterministic ?? false;
	}

	static override get _defaults() {
		return foundry.utils.mergeObject(foundry.data.fields.StringField._defaults, {
			deterministic: false,
		});
	}

	override _validateType(
		value: string,
		options?: foundry.data.fields.DataField.ValidationOptions,
	): void {
		Roll.validate(value);

		if (this.deterministic) {
			const roll = new Roll(value);
			if (!roll.isDeterministic) throw new Error('must not contain dice terms');
		}

		super._validateType(value, options);
	}
}

export { FormulaField };
