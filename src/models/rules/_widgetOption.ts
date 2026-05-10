/**
 * Per-field UI metadata for the rules-builder `<SchemaFieldRenderer>`:
 *
 * - `widget` — picks a specific input widget when the field's type alone
 *   isn't enough to dispatch.
 * - `showWhen` — visibility predicate evaluated against the current rule's
 *   source data; returning `false` hides the field.
 *
 * Naming: Foundry already uses `hint` for built-in form help text, so we
 * use `widget` to avoid the collision.
 *
 * The helper is a no-op at runtime — it launders the option object's type
 * so TypeScript accepts the extras without excess-property checks. We avoid
 * direct augmentation of `DataField.Options` because doing so poisons type
 * inference for unrelated `TypeDataModel` system schemas.
 */

export type WidgetHint =
	| 'formula'
	| 'diceFormula'
	| 'documentUuid'
	| 'predicate'
	| 'templateString'
	| 'richText'
	| 'hidden';

export interface WidgetExtras {
	widget?: WidgetHint;
	showWhen?: (data: Record<string, unknown>) => boolean;
	/**
	 * Restrict accepted drops on `widget: 'documentUuid'` fields. Each entry
	 * is either a top-level type (`'Item'`) or a subtype path (`'Item.spell'`).
	 */
	documentTypes?: string[];
}

export function withWidget<O>(options: O & WidgetExtras): O {
	return options as O;
}
