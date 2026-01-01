import type { SimpleMerge } from './helpers.js';

declare namespace PredicateStatementField {
	type DefaultOptions = SimpleMerge<
		foundry.data.fields.DataField.DefaultOptions,
		{
			required: true;
			nullable: false;
			initial: undefined;
			validationError: 'must be a recognized predication statement';
		}
	>;

	type MergedOptions<Options extends foundry.data.fields.DataField.Options<string>> = SimpleMerge<
		DefaultOptions,
		Options
	>;

	type AssignmentType<Opts extends foundry.data.fields.DataField.Options<string>> =
		foundry.data.fields.DataField.DerivedAssignmentType<string, MergedOptions<Opts>>;

	type InitializedType<Opts extends foundry.data.fields.DataField.Options<string>> =
		foundry.data.fields.DataField.DerivedInitializedType<string, MergedOptions<Opts>>;

	type PersistedType<Opts extends foundry.data.fields.DataField.Options<string>> =
		foundry.data.fields.DataField.DerivedInitializedType<string, MergedOptions<Opts>>;
}

class PredicateStatementField<
	const Options extends
		PredicateStatementField.DefaultOptions = PredicateStatementField.DefaultOptions,
	const AssignmentType = PredicateStatementField.AssignmentType<Options>,
	const InitializedType = PredicateStatementField.InitializedType<Options>,
	const PersistedType = PredicateStatementField.PersistedType<Options>,
> extends foundry.data.fields.DataField<Options, AssignmentType, InitializedType, PersistedType> {
	constructor(options = {} as Options) {
		super({
			...options,
			required: true,
			nullable: false,
			initial: undefined,
			validationError: 'must be a recognized predication statement',
		});
	}

	protected override _validateType(_value: InitializedType): boolean {
		// return StatementValidator.isStatement(value);
		return true;
	}

	/** No casting is available for a predicate statement */
	protected override _cast(value: unknown): AssignmentType {
		return value as object as AssignmentType;
	}

	protected override _cleanType(value: InitializedType): InitializedType {
		return typeof value === 'string' ? (value.trim() as InitializedType) : value;
	}
}

export { PredicateStatementField };
