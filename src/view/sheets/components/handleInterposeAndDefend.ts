import type { ReactionPanelStateOptions } from '../../../../types/components/ReactionPanel.d.ts';
import localize from '../../../utils/localize.js';
import showReactionConfirmation from '../../../utils/showReactionConfirmation.js';
import { getTargetedTokens } from '../../../utils/targeting.js';

export default async function handleInterposeAndDefend(
	options: Pick<
		ReactionPanelStateOptions,
		| 'getActor'
		| 'getDefendSpent'
		| 'getInterposeSpent'
		| 'getNoActions'
		| 'getCombinedIsActiveTurn'
		| 'getCombinedReactionDisabled'
		| 'getOnUseCombinedReaction'
	>,
): Promise<void> {
	const {
		getActor,
		getDefendSpent,
		getInterposeSpent,
		getNoActions,
		getCombinedIsActiveTurn,
		getCombinedReactionDisabled,
		getOnUseCombinedReaction,
	} = options;

	const isDisabled = getCombinedReactionDisabled();

	if (isDisabled) {
		const defendSpent = getDefendSpent();
		const interposeSpent = getInterposeSpent();
		const noActions = getNoActions();
		const isActiveTurn = getCombinedIsActiveTurn();
		const reactionName = localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm');

		const spentReactions: string[] = [];
		if (interposeSpent)
			spentReactions.push(localize('NIMBLE.ui.heroicActions.reactionLabels.interpose'));
		if (defendSpent) spentReactions.push(localize('NIMBLE.ui.heroicActions.reactionLabels.defend'));
		const spentReactionNames = spentReactions.join(' & ');

		const confirmed = await showReactionConfirmation({
			reactionName,
			spentReactionNames,
			noActions,
			hasSpentReactions: spentReactions.length > 0,
			isActiveTurn,
		});
		if (!confirmed) return;

		const reactionUsed = await getOnUseCombinedReaction()({ force: true });
		if (!reactionUsed) return;
	} else {
		const reactionUsed = await getOnUseCombinedReaction()();
		if (!reactionUsed) return;
	}

	const actor = getActor();
	const currentArmorValue = actor.reactive.system.attributes.armor.value ?? 0;
	const targetUuids = getTargetedTokens(actor.id ?? '').map((t) => t.document.uuid);

	await ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		type: 'reaction',
		system: {
			actorName: actor.name,
			actorType: actor.type,
			image: actor.img,
			permissions: actor.permission,
			rollMode: 0,
			reactionType: 'interpose',
			targets: targetUuids,
		},
	} as unknown as ChatMessage.CreateData);

	await ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		type: 'reaction',
		system: {
			actorName: actor.name,
			actorType: actor.type,
			image: actor.img,
			permissions: actor.permission,
			rollMode: 0,
			reactionType: 'defend',
			armorValue: currentArmorValue,
			targets: [],
		},
	} as unknown as ChatMessage.CreateData);
}
