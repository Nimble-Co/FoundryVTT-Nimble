// Custom field options with deterministic flag
interface FormulaFieldOptions {
	required?: boolean;
	nullable?: boolean;
	initial?: string;
	blank?: boolean;
	deterministic?: boolean;
}

const StringField = foundry.data.fields.StringField;

class FormulaField extends StringField {
	/**
	 * Is this formula deterministic?
	 * @defaultValue `false`
	 */
	deterministic: boolean;

	constructor(options?: FormulaFieldOptions) {
		super(options as foundry.data.fields.StringField.DefaultOptions);

		this.deterministic = options?.deterministic ?? false;
	}

	static override get _defaults(): Record<string, unknown> {
		return foundry.utils.mergeObject(StringField._defaults, {
			deterministic: false,
		});
	}

	override _validateType(
		value: string,
		options?: Record<string, unknown>,
	): boolean | foundry.data.validation.DataModelValidationFailure | undefined {
		Roll.validate(value);

		if (this.deterministic) {
			const roll = new Roll(value);
			if (!roll.isDeterministic) throw new Error('must not contain dice terms');
		}

		const result = super._validateType(value, options);
		return result ?? undefined;
	}
}

export { FormulaField };
