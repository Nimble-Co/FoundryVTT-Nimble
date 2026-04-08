import type { ReactionPanelStateOptions } from '../../../../types/components/ReactionPanel.d.ts';
import localize from '../../../utils/localize.js';
import showReactionConfirmation from '../../../utils/showReactionConfirmation.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';
import handleInterposeAndDefend from './handleInterposeAndDefend.js';

export function createDefendPanelState(options: ReactionPanelStateOptions) {
	const { getActor, getReactionDisabled, getDefendSpent, getNoActions, getOnUseReaction } = options;

	// Targeting state
	let targetingVersion = $state(0);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(getActor().id ?? '');
	});

	const selectedTarget = $derived(availableTargets.length === 1 ? availableTargets[0] : null);

	const armorValue = $derived(getActor().reactive.system.attributes.armor.value ?? 0);

	// Set up hook listener for target changes
	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	async function handleDefend(): Promise<void> {
		const isDisabled = getReactionDisabled();

		if (isDisabled) {
			const defendSpent = getDefendSpent();
			const noActions = getNoActions();
			const reactionName = localize('NIMBLE.ui.heroicActions.reactions.defend.label');

			const confirmed = await showReactionConfirmation({
				reactionName,
				spentReactionNames: reactionName,
				noActions,
				hasSpentReactions: defendSpent,
			});
			if (!confirmed) return;

			const reactionUsed = await getOnUseReaction()({ force: true });
			if (!reactionUsed) return;
		} else {
			const reactionUsed = await getOnUseReaction()();
			if (!reactionUsed) return;
		}

		const actor = getActor();
		const currentArmorValue = actor.reactive.system.attributes.armor.value ?? 0;
		const chatData = {
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
		};
		await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
	}

	return {
		get availableTargets() {
			return availableTargets;
		},
		get selectedTarget() {
			return selectedTarget;
		},
		get armorValue() {
			return armorValue;
		},
		getTargetName,
		handleDefend,
		handleInterposeAndDefend: () => handleInterposeAndDefend(options),
	};
}
