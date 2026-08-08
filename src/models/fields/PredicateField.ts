import type { AnyMutableObject } from 'fvtt-types/utils';

import { Predicate, type PredicateLike, type RawPredicate } from '../../etc/Predicate.js';
import { isPlainObject } from '../../utils/isPlainObject.js';

/**
 * Persists a `RawPredicate` and initializes it as a `Predicate` instance, so
 * `this.<field>` on rule models is typed (and behaves) as `Predicate` without
 * per-consumer casts.
 */
class PredicateField<
	const Options extends
		foundry.data.fields.DataField.Options<AnyMutableObject> = foundry.data.fields.ObjectField.DefaultOptions,
> extends foundry.data.fields.ObjectField<Options, RawPredicate, PredicateLike, RawPredicate> {
	override initialize(
		value: RawPredicate,
		model: foundry.abstract.DataModel.Any,
		options?: foundry.data.fields.DataField.InitializeOptions,
	): PredicateLike | (() => PredicateLike | null) {
		const pred = super.initialize(value, model, options) as unknown;
		return isPlainObject(pred)
			? new Predicate(value)
			: (pred as PredicateLike | (() => PredicateLike | null));
	}
}

export { PredicateField };
