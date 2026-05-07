/**
 * Per-field UI metadata for the rules-builder `<SchemaFieldRenderer>`.
 *
 * Two opt-in extras attached inline to a Foundry field's options:
 *
 * - `widget` — directs the renderer to a specific input widget when the
 *   field's type alone is not enough to dispatch (formula text, document
 *   UUID picker, predicate builder, etc.). The literal set is the closed
 *   catalog the renderer knows how to mount.
 * - `showWhen` — a per-render visibility predicate evaluated against the
 *   current rule's source data. Returning `false` hides the field.
 *
 * Naming: `hint` is already a reserved Foundry option for help text on
 * built-in form rendering. `widget` avoids the semantic collision.
 *
 * Why a helper, not type augmentation: directly augmenting
 * `foundry.data.fields.DataField.Options` poisons type inference for
 * unrelated `TypeDataModel` system schemas (NimbleBoonData, NimbleClassData,
 * etc.). The helper is a no-op at runtime — its sole job is to launder the
 * options object's type so TypeScript accepts the extra properties without
 * tripping excess-property checks. The properties land on the field instance
 * via Foundry's `Object.assign(this, options)` in the field constructor,
 * where the renderer reads them at runtime.
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
}

/**
 * Spread `widget` / `showWhen` into a Foundry field's options inline:
 *
 * ```ts
 * new fields.StringField(
 *   withWidget({ required: true, nullable: false, initial: '', widget: 'formula' })
 * )
 * ```
 */
export function withWidget<O>(options: O & WidgetExtras): O {
	return options as O;
}
