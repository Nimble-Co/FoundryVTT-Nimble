import { VALID_WIDGETS } from '../../../models/rules/_widgetOption.js';

// Foundry keeps the original options object on `field.options` and only
// lifts recognised keys onto the field instance. The test mock now
// stores the same options on `.options` (see tests/mocks/foundry.ts) so
// `.options` is the canonical read site in both worlds.
interface FieldExtras {
	widget?: string;
	showWhen?: (data: Record<string, unknown>) => boolean;
	documentTypes?: string[];
}
type FieldWithOptions = { options?: FieldExtras };

export function createSchemaFieldRendererState(
	getField: () => foundry.data.fields.DataField.Any,
	getParentData: () => Record<string, unknown>,
	getOnChange: () => (next: unknown) => void,
	getName: () => string,
) {
	const widget = $derived((getField() as unknown as FieldWithOptions).options?.widget);
	const documentTypes = $derived(
		(getField() as unknown as FieldWithOptions).options?.documentTypes,
	);
	const visibleByPredicate = $derived.by(() => {
		const showWhen = (getField() as unknown as FieldWithOptions).options?.showWhen;
		return typeof showWhen === 'function' ? Boolean(showWhen(getParentData())) : true;
	});

	const isHidden = $derived(widget === 'hidden' || !visibleByPredicate);

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
		const field = getField();
		const onChange = getOnChange();
		if (raw === '') {
			onChange((field as unknown as { nullable?: boolean }).nullable ? null : 0);
			return;
		}
		const num = (field as unknown as { integer?: boolean }).integer
			? parseInt(raw, 10)
			: parseFloat(raw);
		if (!Number.isNaN(num)) onChange(num);
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
