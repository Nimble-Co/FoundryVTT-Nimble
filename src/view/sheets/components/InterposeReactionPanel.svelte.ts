import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

export function createInterposePanelState(
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

	const armorValue = $derived(getActor().reactive.system.attributes.armor.value ?? 0);

	const isDisabled = $derived(!getInCombat() || getActionsRemaining() <= 0);

	const canDefendAndInterpose = $derived(getInCombat() && getActionsRemaining() >= 2);

	// Set up hook listener for target changes
	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	async function handleInterpose(): Promise<void> {
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
				reactionType: 'interpose',
				targets: targetUuids,
			},
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await ChatMessage.create(chatData as any);
	}

	async function handleDefendAndInterpose(): Promise<void> {
		if (!getInCombat() || getActionsRemaining() < 2) return;

		const actor = getActor();
		const targetUuids = availableTargets.map((t) => t.document.uuid);

		// Create Interpose message first (stepping in front of ally)
		await getOnDeductAction()();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
		} as any);

		// Then create Defend message (reducing damage taken)
		await getOnDeductAction()();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
				armorValue,
				targets: [],
			},
		} as any);
	}

	return {
		availableTargets,
		selectedTarget,
		armorValue,
		isDisabled,
		canDefendAndInterpose,
		getTargetName,
		handleInterpose,
		handleDefendAndInterpose,
	};
}
