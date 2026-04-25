import localize from './localize.js';

interface ReactionConfirmationOptions {
	reactionName: string;
	spentReactionNames: string;
	noActions: boolean;
	hasSpentReactions: boolean;
	isActiveTurn?: boolean;
}

/**
 * Shows a confirmation dialog when a reaction is being used in a state that
 * would normally block it (no actions remaining, already spent this round, or
 * the actor is the active combatant) so the player can acknowledge and proceed.
 *
 * @returns true if the user confirmed, false otherwise
 */
export default async function showReactionConfirmation(
	options: ReactionConfirmationOptions,
): Promise<boolean> {
	const { reactionName, spentReactionNames, noActions, hasSpentReactions, isActiveTurn } = options;
	const confirmReaction = 'NIMBLE.ui.heroicActions.confirmReaction';

	const messageParts: string[] = [];
	if (isActiveTurn) {
		messageParts.push(localize(`${confirmReaction}.activeTurnMessage`));
	}
	if (noActions) {
		messageParts.push(localize(`${confirmReaction}.noActionsMessage`));
	}
	if (hasSpentReactions) {
		messageParts.push(
			localize(`${confirmReaction}.spentMessage`, { reaction: spentReactionNames }),
		);
	}
	const message = messageParts.join(' ');

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
