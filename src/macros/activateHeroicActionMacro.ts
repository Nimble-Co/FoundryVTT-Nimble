import type { NimbleCharacter } from '../documents/actor/character.js';
import { getActiveCombatForCurrentScene } from '../utils/combatState.js';
import type { HeroicReactionKey } from '../utils/heroicActions.js';
import { getMovementSpeeds } from '../utils/movementSpeeds.js';
import { getTargetedTokens } from '../utils/targeting.js';

type CombatWithHeroicReactionUse = Combat & {
	useHeroicReactions?: (combatantId: string, reactionKeys: HeroicReactionKey[]) => Promise<boolean>;
};

/**
 * The function called by macros created by dragging a heroic action/reaction to the macro hot bar.
 *
 * @param actionId - The id of the heroic action/reaction (e.g., 'attack', 'defend')
 * @param actionType - Whether this is an 'action' or 'reaction'
 */
export async function activateHeroicActionMacro(
	actionId: string,
	actionType: 'action' | 'reaction',
): Promise<void> {
	const speaker = ChatMessage.getSpeaker();

	let actor: Actor | undefined;
	if (speaker.token) actor = game.actors.tokens[speaker.token as string];
	if (!actor && speaker.actor) actor = game.actors.get(speaker.actor as string) ?? undefined;

	if (!actor || actor.type !== 'character') {
		ui.notifications.warn('Select a character token to use this action');
		return;
	}

	// Handle move action directly without opening the sheet
	if (actionId === 'move' && actionType === 'action') {
		await executeMoveAction(actor as NimbleCharacter);
		return;
	}

	// Handle defend reaction directly
	if (actionId === 'defend' && actionType === 'reaction') {
		await executeDefendReaction(actor as NimbleCharacter);
		return;
	}

	// Handle interpose reaction directly
	if (actionId === 'interpose' && actionType === 'reaction') {
		await executeInterposeReaction(actor as NimbleCharacter);
		return;
	}

	// Handle interpose & defend combo directly
	if (actionId === 'interposeAndDefend' && actionType === 'reaction') {
		await executeInterposeAndDefendReaction(actor as NimbleCharacter);
		return;
	}

	// Open sheet and navigate to action panel
	const sheet = actor.sheet as foundry.applications.sheets.ActorSheetV2 & {
		$state: Record<string, unknown>;
	};
	await sheet.render(true);

	// Set app state to navigate to the actions tab and expand correct panel
	const appState = sheet.$state;
	appState.activePrimaryTab = 'actions';
	appState.heroicActionTarget = { actionId, actionType };
}

async function executeMoveAction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const inCombat = combatant?.initiative !== null;

	if (!inCombat) {
		ui.notifications.warn('You must be in combat to use the Move action');
		return;
	}

	// Get current actions
	// @ts-expect-error - combatant.system is not typed
	const actions = combatant?.system?.actions?.base;
	const actionsRemaining = actions?.current ?? 0;

	if (actionsRemaining <= 0) {
		ui.notifications.warn('No actions remaining');
		return;
	}

	// Deduct action pip
	await combatant!.update({ 'system.actions.base.current': actionsRemaining - 1 } as Record<
		string,
		unknown
	>);

	// Get movement speed
	const movementSpeeds = getMovementSpeeds(actor);
	const primarySpeed = movementSpeeds.find((s) => s.type === 'walk') ?? movementSpeeds[0];

	// Create chat message
	await ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		type: 'moveAction',
		system: {
			actorName: actor.name,
			speed: primarySpeed?.value ?? 0,
		},
	} as unknown as ChatMessage.CreateData);
}

async function executeDefendReaction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const combatantId = combatant?.id ?? combatant?._id ?? null;

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn('You must be in combat to use the Defend reaction');
		return;
	}

	const reactionUsed = await combat.useHeroicReactions(combatantId, ['defend']);
	if (!reactionUsed) return;

	const armorValue = actor.reactive.system.attributes.armor.value ?? 0;

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
	} as unknown as ChatMessage.CreateData);
}

async function executeInterposeReaction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const combatantId = combatant?.id ?? combatant?._id ?? null;

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn('You must be in combat to use the Interpose reaction');
		return;
	}

	const reactionUsed = await combat.useHeroicReactions(combatantId, ['interpose']);
	if (!reactionUsed) return;

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
}

async function executeInterposeAndDefendReaction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const combatantId = combatant?.id ?? combatant?._id ?? null;

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn('You must be in combat to use the Interpose & Defend reaction');
		return;
	}

	const reactionUsed = await combat.useHeroicReactions(combatantId, ['interpose', 'defend']);
	if (!reactionUsed) return;

	const armorValue = actor.reactive.system.attributes.armor.value ?? 0;
	const targetUuids = getTargetedTokens(actor.id ?? '').map((t) => t.document.uuid);

	// Create Interpose message first
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

	// Then create Defend message
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
	} as unknown as ChatMessage.CreateData);
}
