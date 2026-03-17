import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

export function createDefendPanelState(
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

	const isDisabled = $derived(getInCombat() && getActionsRemaining() <= 0);

	const canInterposeAndDefend = $derived(!getInCombat() || getActionsRemaining() >= 2);

	// Set up hook listener for target changes
	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	async function handleDefend(): Promise<void> {
		if (!getInCombat() || getActionsRemaining() <= 0) return;

		await getOnDeductAction()();

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

	async function handleInterposeAndDefend(): Promise<void> {
		if (!getInCombat() || getActionsRemaining() < 2) return;

		const actor = getActor();
		const currentArmorValue = actor.reactive.system.attributes.armor.value ?? 0;
		const targetUuids = getTargetedTokens(actor.id ?? '').map((t) => t.document.uuid);

		// Create Interpose message first (stepping in front of ally)
		await getOnDeductAction()();
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

		// Then create Defend message (reducing damage taken)
		await getOnDeductAction()();
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
		get isDisabled() {
			return isDisabled;
		},
		get canInterposeAndDefend() {
			return canInterposeAndDefend;
		},
		getTargetName,
		handleDefend,
		handleInterposeAndDefend,
	};
}
