import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

export function createHelpPanelState(
	getActor: () => NimbleCharacter,
	getOnDeductAction: () => () => Promise<void>,
	getInCombat: () => boolean,
	getActionsRemaining: () => number,
) {
	// Targeting state
	let targetingVersion = $state(0);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(getActor().id ?? '');
	});

	const selectedTarget = $derived(availableTargets.length === 1 ? availableTargets[0] : null);

	const isDisabled = $derived(!getInCombat() || getActionsRemaining() <= 0);

	// Set up hook listener for target changes
	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	async function handleHelp(): Promise<void> {
		if (!getInCombat() || getActionsRemaining() <= 0) return;

		await getOnDeductAction()();

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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await ChatMessage.create(chatData as any);
	}

	return {
		availableTargets,
		selectedTarget,
		isDisabled,
		getTargetName,
		handleHelp,
	};
}
