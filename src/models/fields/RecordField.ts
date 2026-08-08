import type { SimpleMerge } from './helpers.js';

declare namespace RecordField {
	type Options<IValueField> = foundry.data.fields.DataField.Options<
		Record<string, BaseAssignmentType<IValueField>>
	>;

	type BaseAssignmentType<AssignmentElementType> =
		foundry.data.fields.ArrayField.BaseAssignmentType<AssignmentElementType>;

	type DefaultOptions<AssignmentElementType> = SimpleMerge<
		foundry.data.fields.DataField.DefaultOptions,
		{
			required: true;
			nullable: false;
			initial: () => Record<string, AssignmentElementType>;
		}
	>;

	type MergedOptions<
		AssignmentElementType,
		Opts extends Options<AssignmentElementType>,
	> = SimpleMerge<DefaultOptions<AssignmentElementType>, Opts>;

	type AssignmentElementType<IValueField extends foundry.data.fields.DataField.Any> =
		IValueField extends foundry.data.fields.DataField<any, infer AssignType, any, any>
			? AssignType
			: never;

	type InitializedElementType<IValueField extends foundry.data.fields.DataField.Any> =
		IValueField extends foundry.data.fields.DataField<any, any, infer InitType, any>
			? InitType
			: never;

	type PersistedElementType<IValueField extends foundry.data.fields.DataField.Any> =
		IValueField extends foundry.data.fields.DataField<any, any, any, infer PersistType>
			? PersistType
			: never;

	type AssignmentType<
		AET,
		Opts extends Options<AET>,
	> = foundry.data.fields.DataField.DerivedAssignmentType<
		BaseAssignmentType<AET>,
		MergedOptions<AET, Opts>
	>;

	type InitializedType<
		AET,
		IET,
		Opts extends Options<AET>,
	> = foundry.data.fields.DataField.DerivedInitializedType<
		Record<string, IET>,
		MergedOptions<AET, Opts>
	>;

	type PersistedType<
		AET,
		PET,
		Opts extends Options<AET>,
	> = foundry.data.fields.DataField.DerivedInitializedType<
		Record<string, PET>,
		MergedOptions<AET, Opts>
	>;
}

/**
 * A record-shaped field with validated keys and a uniform value field.
 *
 * Extends V14's TypedObjectField, which natively provides per-entry cleaning,
 * validation, initialization, and — critically — per-key update semantics
 * (`ForcedDeletion` removes an entry; plain ObjectField treats the record as
 * one opaque blob and silently mishandles entry deletion).
 */
class RecordField<
	const IKeyField extends foundry.data.fields.DataField.Any,
	const IValueField extends foundry.data.fields.DataField.Any,
	const AssignmentElementType = RecordField.AssignmentElementType<IValueField>,
	const _InitializedElementType = RecordField.InitializedElementType<IValueField>,
	const PersistedElementType = RecordField.PersistedElementType<IValueField>,
	const Options extends
		RecordField.Options<AssignmentElementType> = RecordField.DefaultOptions<AssignmentElementType>,
	const AssignmentType = RecordField.AssignmentType<AssignmentElementType, Options>,
	const InitializedType = RecordField.InitializedType<
		AssignmentElementType,
		_InitializedElementType,
		Options
	>,
	const PersistedType extends
		| Record<string, PersistedElementType>
		| null
		| undefined = RecordField.PersistedType<AssignmentElementType, PersistedElementType, Options>,
> extends foundry.data.fields.TypedObjectField<
	IValueField,
	foundry.data.fields.TypedObjectField.DefaultOptions,
	AssignmentType,
	InitializedType,
	PersistedType
> {
	keyField: IKeyField;

	constructor(keyField: IKeyField, valueField: IValueField, options?: Options) {
		super(valueField, {
			...options,
			// TypedObjectField strips keys for which this returns exactly `false`.
			validateKey: (key: string) => keyField.validate(key) === undefined,
		} as unknown as foundry.data.fields.TypedObjectField.DefaultOptions);

		if (!this._isValidKeyFieldType(keyField))
			throw new Error('key field must be a StringField or a NumberField');
		this.keyField = keyField;
	}

	_isValidKeyFieldType(keyField: IKeyField): boolean {
		if (
			keyField instanceof foundry.data.fields.StringField ||
			keyField instanceof foundry.data.fields.NumberField
		) {
			if (keyField.options.required !== true || keyField.options.nullable === true) {
				throw new Error('key field must be required and non-nullable');
			}
			return true;
		}
		return false;
	}
}

export { RecordField };
