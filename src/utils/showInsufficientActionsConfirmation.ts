import localize from './localize.js';

interface InsufficientActionsConfirmationOptions {
	activityName: string;
	requiredActions: number;
	currentActions: number;
	force?: boolean;
}

/**
 * Soft-block gate for uses that would cost more actions than the combatant has
 * remaining. Resolves `true` when the use may proceed: immediately when the
 * cost is affordable or `force` is set, otherwise only after the player
 * confirms the overspend in a dialog.
 *
 * @returns true if the use may proceed, false otherwise
 */
export default async function showInsufficientActionsConfirmation(
	options: InsufficientActionsConfirmationOptions,
): Promise<boolean> {
	const { activityName, requiredActions, currentActions, force } = options;

	if (force === true) return true;
	if (currentActions >= requiredActions) return true;

	const confirmKey = 'NIMBLE.ui.confirmInsufficientActions';

	const message = localize(`${confirmKey}.message`, {
		cost: String(requiredActions),
		current: String(currentActions),
	});
	const confirmQuestion = localize(`${confirmKey}.confirmQuestion`, { name: activityName });

	const confirmed = await foundry.applications.api.DialogV2.confirm({
		window: { title: localize(`${confirmKey}.title`) },
		content: `<p>${message}</p><p>${confirmQuestion}</p>`,
		yes: { label: localize(`${confirmKey}.confirm`) },
		no: { label: localize(`${confirmKey}.cancel`) },
		rejectClose: false,
	});

	return confirmed === true;
}
