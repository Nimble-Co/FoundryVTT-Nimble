import { Predicate, type RawPredicate } from '../../etc/Predicate.js';

/**
 * A custom field for storing predicate data.
 * The initialized value is a Predicate instance created from the stored object data.
 */
class PredicateField extends foundry.data.fields.ObjectField<
	foundry.data.fields.ObjectField.DefaultOptions,
	foundry.data.fields.ObjectField.AssignmentType<foundry.data.fields.ObjectField.DefaultOptions>,
	Predicate,
	RawPredicate
> {
	protected override _cast(value: RawPredicate): RawPredicate {
		return value;
	}

	override initialize(value: RawPredicate, _model: foundry.abstract.DataModel.Any): Predicate {
		return new Predicate(value ?? {});
	}
}

export { PredicateField };
