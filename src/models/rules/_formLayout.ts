/**
 * Opt-in layout for a rule's form in the rules builder. A rule class that
 * sets `static formLayout` gets its fields shown in these groups, in this
 * order. Rules without one keep the flat field list.
 *
 * A group with no `label` takes its heading from its only field. Schema
 * fields that no group names are shown after the last group. `predicate`
 * may be placed in a group; it then leaves the Advanced section.
 */
export interface RuleFormGroup {
	/** Lang key of the question above the group. */
	label?: string;
	/** Lang key of a hint below the group. */
	hint?: string;
	/** Schema field names, in display order. */
	fields: readonly string[];
}
