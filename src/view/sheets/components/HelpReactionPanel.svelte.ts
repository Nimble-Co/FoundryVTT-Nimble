import type { NimbleCharacter } from '../../../documents/actor/character.js';
import localize from '../../../utils/localize.js';
import showReactionConfirmation from '../../../utils/showReactionConfirmation.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

export function createHelpPanelState(
	getActor: () => NimbleCharacter,
	getReactionDisabled: () => boolean,
	getHelpSpent: () => boolean,
	getNoActions: () => boolean,
	getOnUseReaction: () => (options?: { force?: boolean }) => Promise<boolean>,
) {
	// Targeting state
	let targetingVersion = $state(0);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(getActor().id ?? '');
	});

	const selectedTarget = $derived(availableTargets.length === 1 ? availableTargets[0] : null);

	// Set up hook listener for target changes
	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	async function handleHelp(): Promise<void> {
		const isDisabled = getReactionDisabled();

		if (isDisabled) {
			const helpSpent = getHelpSpent();
			const noActions = getNoActions();
			const reactionName = localize('NIMBLE.ui.heroicActions.reactions.help.label');

			const confirmed = await showReactionConfirmation({
				reactionName,
				spentReactionNames: reactionName,
				noActions,
				hasSpentReactions: helpSpent,
			});
			if (!confirmed) return;

			const reactionUsed = await getOnUseReaction()({ force: true });
			if (!reactionUsed) return;
		} else {
			const reactionUsed = await getOnUseReaction()();
			if (!reactionUsed) return;
		}

		const actor = getActor();
		const targetUuids = availableTargets.map((t) => t.document.uuid);

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
				reactionType: 'help',
				targets: targetUuids,
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
		getTargetName,
		handleHelp,
	};
}
