interface FieldExtras {
	widget?: string | ((data: Record<string, unknown>) => string);
	showWhen?: (data: Record<string, unknown>) => boolean;
}

/** Whether a rule field shows for the current data: its `showWhen`, and not the `hidden` widget. */
export function isFieldShown(
	field: foundry.data.fields.DataField.Any,
	data: Record<string, unknown>,
): boolean {
	const options = (field as unknown as { options?: FieldExtras }).options;
	const widget = typeof options?.widget === 'function' ? options.widget(data) : options?.widget;
	if (widget === 'hidden') return false;
	return typeof options?.showWhen === 'function' ? Boolean(options.showWhen(data)) : true;
}
