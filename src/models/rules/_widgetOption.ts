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
 * The helper is a near no-op at runtime — it launders the option object's
 * type so TypeScript accepts the extras without excess-property checks,
 * and validates the extras in dev mode. We avoid direct augmentation of
 * `DataField.Options` because doing so poisons type inference for
 * unrelated `TypeDataModel` system schemas.
 */

export const WIDGET_HINTS = [
	'formula',
	'diceFormula',
	'documentUuid',
	'predicate',
	'templateString',
	'richText',
	'hidden',
] as const;

export type WidgetHint = (typeof WIDGET_HINTS)[number];

export const VALID_WIDGETS: ReadonlySet<string> = new Set(WIDGET_HINTS);

export interface WidgetExtras {
	widget?: WidgetHint;
	showWhen?: (data: Record<string, unknown>) => boolean;
	/**
	 * Restrict accepted drops on `widget: 'documentUuid'` fields. Each entry
	 * is either a top-level type (`'Item'`) or a subtype path (`'Item.spell'`).
	 */
	documentTypes?: string[];
}

/** Detect dev/test environments. Vite inlines `import.meta.env.DEV` to a
 *  boolean at build time; in vitest it's true; in production builds it's
 *  stripped. */
function isDev(): boolean {
	try {
		return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
	} catch {
		return false;
	}
}

function validateWidgetExtras(opts: WidgetExtras, label: string): void {
	if (opts.widget !== undefined && !VALID_WIDGETS.has(opts.widget)) {
		console.warn(
			`Nimble | ${label}: unknown widget hint "${opts.widget}". ` +
				`Valid: ${WIDGET_HINTS.join(', ')}.`,
		);
	}
	if (opts.showWhen !== undefined && typeof opts.showWhen !== 'function') {
		console.warn(`Nimble | ${label}: showWhen must be a function.`);
	}
	if (opts.documentTypes !== undefined) {
		if (!Array.isArray(opts.documentTypes)) {
			console.warn(`Nimble | ${label}: documentTypes must be an array.`);
		} else {
			for (const entry of opts.documentTypes) {
				if (typeof entry !== 'string' || !/^[A-Z][A-Za-z]*(\.[a-zA-Z][\w-]*)?$/.test(entry)) {
					console.warn(
						`Nimble | ${label}: documentTypes entry "${entry}" should look like ` +
							`"Item" or "Item.spell".`,
					);
				}
			}
		}
	}
}

/**
 * Launder the option object so TypeScript accepts the widget extras, and
 * validate them in dev. Pass an optional `label` (e.g. the field name) so
 * warnings carry context.
 */
export function withWidget<O>(options: O & WidgetExtras, label = 'withWidget'): O {
	if (isDev()) validateWidgetExtras(options, label);
	return options as O;
}
