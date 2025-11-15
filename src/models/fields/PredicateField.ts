import type DataModel from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/data.d.mts';
import type { AnyObject } from '@league-of-foundry-developers/foundry-vtt-types/src/types/utils.d.mts';

import { Predicate } from '../../etc/Predicate';
import { isPlainObject } from '../../utils/isPlainObject';

// class PredicateField<
//   const EFT extends PredicateStatementField = PredicateStatementField,
//   const AET = foundry.data.fields.ArrayField.AssignmentElementType<EFT>,
//   const IET = foundry.data.fields.ArrayField.InitializedElementType<EFT>,
//   const PET = foundry.data.fields.ArrayField.PersistedElementType<EFT>,
//   const Opts extends foundry.data.fields.ArrayField.Options<AET>
//   = foundry.data.fields.ArrayField.DefaultOptions<AET>,
//   const AssignmentType = foundry.data.fields.ArrayField.AssignmentType<AET, Opts>,
//   const InitializedType = foundry.data.fields.ArrayField.InitializedType<AET, IET, Opts>,
//   const PersistedType extends PET[] | null | undefined
//   = foundry.data.fields.ArrayField.PersistedType<AET, PET, Opts>
// > extends foundry.data.fields.ArrayField<EFT> {
//   constructor(options = {}) {
//     super(
//       // @ts-expect-error
//       new PredicateStatementField(),
//       {
//         label: 'Nimble.RuleEditor.General.Predicate',
//         ...options
//       }
//     );
//   }

//   /** Construct a `Predicate` from the initialized `PredicateStatement[]` */
//   override initialize(
//     value: PersistedType,
//     model: foundry.abstract.DataModel.Any,
//     options?: { readonly [K: string]: unknown; }
//   ): InitializedType | (() => InitializedType | null) {
//     const statements = super.initialize(value, model, options);
//     return Array.isArray(statements) ? new Predicate(...statements) : statements;
//   }
// }

class PredicateField extends foundry.data.fields.ObjectField {
	override initialize(
		value: AnyObject,
		model: DataModel.Any,
		options?: AnyObject,
	): AnyObject | (() => AnyObject | null) {
		const pred = super.initialize(value, model, options);
		return isPlainObject(pred) ? new Predicate(value) : pred;
	}
}

export { PredicateField };
