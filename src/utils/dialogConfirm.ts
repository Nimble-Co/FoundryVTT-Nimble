import localize from './localize.js';

export interface DialogConfirmOptions {
	title?: string;
	content?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	confirmIcon?: string;
	cancelIcon?: string;
	// If true, present Confirm on the right and Cancel on the left.
	confirmOnRight?: boolean;
	modal?: boolean;
	rejectClose?: boolean;
}

/**
 * Wrapper around Foundry's DialogV2.confirm to allow placing the Confirm
 * button on the right (and swapping icons) while returning a boolean where
 * `true` always means the user confirmed.
 */
export default async function dialogConfirm(options: DialogConfirmOptions): Promise<boolean> {
	const {
		title,
		content,
		confirmLabel = localize('NIMBLE.common.confirm'),
		cancelLabel = localize('NIMBLE.common.cancel'),
		confirmIcon = 'fa-solid fa-check',
		cancelIcon = 'fa-solid fa-xmark',
		confirmOnRight = true,
		modal = false,
		rejectClose = true,
	} = options;

	// DialogV2 expects a `yes` and `no` key. By default we want Confirm on the
	// right. Foundry's implementation maps `yes` -> resolved true and `no` ->
	// resolved false. Many UIs render `yes` on the left and `no` on the right,
	// so to present Confirm on the right we swap which label/icon we pass to
	// which key, then normalize the resolved value so `true` always means
	// confirmed.
	const yes = confirmOnRight
		? { label: cancelLabel, icon: cancelIcon }
		: { label: confirmLabel, icon: confirmIcon };
	const no = confirmOnRight
		? { label: confirmLabel, icon: confirmIcon }
		: { label: cancelLabel, icon: cancelIcon };

	const resolved = await foundry.applications.api.DialogV2.confirm({
		window: title ? { title } : undefined,
		content,
		yes,
		no,
		rejectClose,
		modal,
	});

	// If we swapped labels to put Confirm on the right, then a resolved === false
	// means the user clicked the right-side Confirm button. Normalize so true
	// means confirmed.
	return confirmOnRight ? resolved === false : resolved === true;
}
