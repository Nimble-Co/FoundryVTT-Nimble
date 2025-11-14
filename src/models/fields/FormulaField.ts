import type { SimpleMerge } from './helpers.js';

declare namespace FormulaField {
	type DefaultOptions = SimpleMerge<
		foundry.data.fields.StringField.DefaultOptions,
		{
			deterministic: false;
		}
	>;

	interface Options extends StringFieldOptions {
		deterministic?: boolean | undefined;
	}
}

class FormulaField<
	const Options extends FormulaField.Options = FormulaField.DefaultOptions,
	const AssignmentType = foundry.data.fields.StringField.AssignmentType<Options>,
	const InitializedType = foundry.data.fields.StringField.InitializedType<Options>,
	const PersistedType extends
		| string
		| null
		| undefined = foundry.data.fields.StringField.AssignmentType<Options>,
> extends foundry.data.fields.StringField<Options, AssignmentType, InitializedType, PersistedType> {
	/**
	 * Is this formula deterministic?
	 * @defaultValue `false`
	 */
	deterministic: boolean;

	constructor(options?: Options) {
		super(options);

		this.deterministic = options?.deterministic ?? false;
	}

	static override get _defaults() {
		return foundry.utils.mergeObject(foundry.data.fields.StringField._defaults, {
			deterministic: false,
		});
	}

	override _validateType(
		value: InitializedType,
		options?: foundry.data.fields.DataField.ValidationOptions<foundry.data.fields.DataField.Any>,
	): boolean | foundry.data.validation.DataModelValidationFailure | undefined {
		Roll.validate(value as string);

		if (this.deterministic) {
			const roll = new Roll(value as string);
			if (!roll.isDeterministic) throw new Error('must not contain dice terms');
		}

		super._validateType(value, options);
	}
}

export { FormulaField };
