import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

export function createHelpPanelState(
	getActor: () => NimbleCharacter,
	getOnDeductAction: () => () => Promise<void>,
	getActionsRemaining: () => number,
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
		if (getActionsRemaining() <= 0) return;

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
