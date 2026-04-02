import type { NimbleCharacter } from '../../../documents/actor/character.js';
import localize from '../../../utils/localize.js';
import showReactionConfirmation from '../../../utils/showReactionConfirmation.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

export function createDefendPanelState(
	getActor: () => NimbleCharacter,
	getReactionDisabled: () => boolean,
	getDefendSpent: () => boolean,
	getInterposeSpent: () => boolean,
	getNoActions: () => boolean,
	getOnUseReaction: () => (options?: { force?: boolean }) => Promise<boolean>,
	getCombinedReactionDisabled: () => boolean,
	getOnUseCombinedReaction: () => (options?: { force?: boolean }) => Promise<boolean>,
) {
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

	async function handleInterposeAndDefend(): Promise<void> {
		const isDisabled = getCombinedReactionDisabled();

		if (isDisabled) {
			const defendSpent = getDefendSpent();
			const interposeSpent = getInterposeSpent();
			const noActions = getNoActions();
			const reactionName = localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm');

			// Build spent reactions string
			const spentReactions: string[] = [];
			if (interposeSpent)
				spentReactions.push(localize('NIMBLE.ui.heroicActions.reactionLabels.interpose'));
			if (defendSpent)
				spentReactions.push(localize('NIMBLE.ui.heroicActions.reactionLabels.defend'));
			const spentReactionNames = spentReactions.join(' & ');

			const confirmed = await showReactionConfirmation({
				reactionName,
				spentReactionNames,
				noActions,
				hasSpentReactions: spentReactions.length > 0,
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

		// Create Interpose message first (stepping in front of ally)
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
		getTargetName,
		handleDefend,
		handleInterposeAndDefend,
	};
}
