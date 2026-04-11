import localize from './localize.js';

interface ReactionConfirmationOptions {
	reactionName: string;
	spentReactionNames: string;
	noActions: boolean;
	hasSpentReactions: boolean;
}

/**
 * Shows a confirmation dialog when a reaction is being used but the character
 * has no actions remaining or has already spent the reaction this round.
 *
 * @returns true if the user confirmed, false otherwise
 */
export default async function showReactionConfirmation(
	options: ReactionConfirmationOptions,
): Promise<boolean> {
	const { reactionName, spentReactionNames, noActions, hasSpentReactions } = options;
	const confirmReaction = 'NIMBLE.ui.heroicActions.confirmReaction';

	let message: string;
	if (noActions && hasSpentReactions) {
		message = localize(`${confirmReaction}.bothMessage`, { reaction: spentReactionNames });
	} else if (noActions) {
		message = localize(`${confirmReaction}.noActionsMessage`);
	} else {
		message = localize(`${confirmReaction}.spentMessage`, { reaction: spentReactionNames });
	}

	const confirmQuestion = localize(`${confirmReaction}.confirmQuestion`, {
		reaction: reactionName,
	});

	const confirmed = await foundry.applications.api.DialogV2.confirm({
		window: { title: localize(`${confirmReaction}.title`) },
		content: `<p>${message}</p><p>${confirmQuestion}</p>`,
		yes: { label: localize(`${confirmReaction}.confirm`) },
		no: { label: localize(`${confirmReaction}.cancel`) },
		rejectClose: false,
	});

	return confirmed === true;
}
