import localize from '#utils/localize.js';
import { VALID_WIDGETS } from '../../../models/rules/_widgetOption.js';
import { isFieldShown } from './isFieldShown.js';

// Foundry keeps the original options object on `field.options` and only
// lifts recognised keys onto the field instance. The test mock now
// stores the same options on `.options` (see tests/mocks/foundry.ts) so
// `.options` is the canonical read site in both worlds.
interface FieldExtras {
	widget?: string | ((data: Record<string, unknown>) => string);
	documentTypes?: string[];
}
type FieldWithOptions = { options?: FieldExtras };

/** The label of a field inside a list row or group: its `label`, else its name as words. */
export function childFieldLabel(name: string, field: foundry.data.fields.DataField.Any): string {
	const label = (field as { label?: string }).label;
	if (label) return localize(label);
	return name
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (c) => c.toUpperCase())
		.trim();
}

/** The hint of a field inside a list row or group, or an empty string. */
export function childFieldHint(field: foundry.data.fields.DataField.Any): string {
	const hint = (field as { hint?: string }).hint;
	return hint ? localize(hint) : '';
}

export function createSchemaFieldRendererState(
	getField: () => foundry.data.fields.DataField.Any,
	getParentData: () => Record<string, unknown>,
	getOnChange: () => (next: unknown) => void,
	getName: () => string,
) {
	// A field may pick its widget from sibling values (see `WidgetResolver`),
	// so resolve against the same data `showWhen` reads. Everything downstream
	// — the dispatch table, `isHidden`, the unknown-hint warning — sees a
	// plain string either way.
	const widget = $derived.by(() => {
		const raw = (getField() as unknown as FieldWithOptions).options?.widget;
		return typeof raw === 'function' ? raw(getParentData()) : raw;
	});
	const documentTypes = $derived(
		(getField() as unknown as FieldWithOptions).options?.documentTypes,
	);
	const isHidden = $derived(!isFieldShown(getField(), getParentData()));

	function setupUnknownWidgetWarning(): void {
		// Warn if a rule schema set a widget hint we don't recognise — typos
		// (`fromula`) would otherwise silently fall through to the type-default
		// arm and look like a working plain input.
		$effect(() => {
			if (widget !== undefined && !VALID_WIDGETS.has(widget)) {
				console.warn(
					`Nimble | SchemaFieldRenderer: unknown widget hint "${widget}" on field "${getName()}". ` +
						`Falling back to type default.`,
				);
			}
		});
	}

	function resolveChoices(): Array<[string, string]> | null {
		const raw = (getField() as unknown as { choices?: unknown }).choices;
		if (raw == null) return null;
		const evaluated = typeof raw === 'function' ? (raw as () => unknown)() : raw;
		if (Array.isArray(evaluated)) {
			return (evaluated as string[]).map((v) => [v, v]);
		}
		if (evaluated && typeof evaluated === 'object') {
			return Object.entries(evaluated as Record<string, string>).map(([key, label]) => [
				key,
				typeof label === 'string' ? label : key,
			]);
		}
		return null;
	}

	function emitNumber(event: Event) {
		const target = event.target as HTMLInputElement;
		const raw = target.value;
		const field = getField() as unknown as {
			nullable?: boolean;
			integer?: boolean;
			validate?: (value: unknown) => unknown;
		};
		let next: number | null;
		if (raw === '') next = field.nullable ? null : 0;
		else next = field.integer ? parseInt(raw, 10) : parseFloat(raw);
		if (Number.isNaN(next)) return;
		if (field.validate?.(next)) {
			const old = getParentData()[getName()];
			target.value = old === null || old === undefined ? '' : String(old);
			return;
		}
		getOnChange()(next);
	}

	function emitString(event: Event) {
		const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
		getOnChange()(target.value);
	}

	function emitBoolean(event: Event) {
		const target = event.target as HTMLInputElement;
		getOnChange()(target.checked);
	}

	function toggleArrayValue(arr: unknown[], v: string | number) {
		const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
		getOnChange()(next);
	}

	return {
		get widget() {
			return widget;
		},
		get documentTypes() {
			return documentTypes;
		},
		get isHidden() {
			return isHidden;
		},
		setupUnknownWidgetWarning,
		resolveChoices,
		emitNumber,
		emitString,
		emitBoolean,
		toggleArrayValue,
	};
}
