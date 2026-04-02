import { DamageRoll } from '../dice/DamageRoll.js';
import type { NimbleCharacter } from '../documents/actor/character.js';
import ItemActivationConfigDialog from '../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { getActiveCombatForCurrentScene } from '../utils/combatState.js';
import { getHeroicReactionUsageState } from '../utils/getHeroicReactionUsageState.js';
import {
	getHeroicReactionAvailability,
	getHeroicReactionLabel,
	type HeroicReactionKey,
} from '../utils/heroicActions.js';
import localize from '../utils/localize.js';
import { getMovementSpeeds } from '../utils/movementSpeeds.js';
import { getTargetedTokens } from '../utils/targeting.js';
import {
	getUnarmedDamageFormula,
	hasUnarmedProficiency,
} from '../view/sheets/components/attackUtils.js';

type CombatWithHeroicReactionUse = Combat & {
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: HeroicReactionKey[],
		options?: { force?: boolean },
	) => Promise<boolean>;
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
		ui.notifications.warn(localize('NIMBLE.ui.heroicActions.macroWarnings.selectCharacterToken'));
		return;
	}

	// Handle move action directly without opening the sheet
	if (actionId === 'move' && actionType === 'action') {
		await executeMoveAction(actor as NimbleCharacter);
		return;
	}

	// Handle unarmed strike directly
	if (actionId === 'unarmedStrike' && actionType === 'action') {
		await executeUnarmedStrike(actor as NimbleCharacter);
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

	// Handle help reaction directly
	if (actionId === 'help' && actionType === 'reaction') {
		await executeHelpReaction(actor as NimbleCharacter);
		return;
	}

	// Handle opportunity attack reaction directly
	if (actionId === 'opportunity' && actionType === 'reaction') {
		await executeOpportunityAttackReaction(actor as NimbleCharacter);
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

/**
 * Checks if a reaction requires confirmation due to missing actions or being spent.
 * If confirmation is needed, shows a dialog and returns whether the user confirmed.
 * Returns true if the reaction can proceed (either no issues or user confirmed).
 */
async function checkReactionConfirmation(
	actor: NimbleCharacter,
	reactionKeys: HeroicReactionKey[],
	reactionName: string,
): Promise<boolean> {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);

	if (!combat || !combatant) return true;

	const usageState = getHeroicReactionUsageState({
		combat,
		combatant,
		reactionKeys,
	});

	// Only show confirmation for 'noActions' or 'spent' blocked reasons
	if (usageState.blockedReason !== 'noActions' && usageState.blockedReason !== 'spent') {
		return true;
	}

	const confirmReaction = 'NIMBLE.ui.heroicActions.confirmReaction';
	const noActions =
		usageState.blockedReason === 'noActions' ||
		usageState.currentActions < usageState.requiredActions;

	// Check which specific reactions are spent
	const spentReactions = reactionKeys.filter(
		(key) => !getHeroicReactionAvailability(combatant, key),
	);
	const hasSpentReactions = spentReactions.length > 0;

	// Get the localized names of spent reactions
	const spentReactionNames = spentReactions.map((key) => getHeroicReactionLabel(key)).join(' & ');

	let message: string;
	if (noActions && hasSpentReactions) {
		message = localize(`${confirmReaction}.bothMessage`, { reaction: spentReactionNames });
	} else if (noActions) {
		message = localize(`${confirmReaction}.noActionsMessage`);
	} else {
		message = localize(`${confirmReaction}.spentMessage`, { reaction: spentReactionNames });
	}

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

async function executeMoveAction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const inCombat = combatant?.initiative !== null;

	if (!inCombat) {
		const actionName = localize('NIMBLE.ui.heroicActions.actions.move.label');
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: actionName }),
		);
		return;
	}

	// Get current actions
	// @ts-expect-error - combatant.system is not typed
	const actions = combatant?.system?.actions?.base;
	const actionsRemaining = actions?.current ?? 0;

	if (actionsRemaining <= 0) {
		// Show confirmation dialog
		const confirmMove = 'NIMBLE.ui.heroicActions.confirmMove';
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: localize(`${confirmMove}.title`) },
			content: `<p>${localize(`${confirmMove}.noActionsMessage`)}</p><p>${localize(`${confirmMove}.confirmQuestion`)}</p>`,
			yes: { label: localize(`${confirmMove}.confirm`) },
			no: { label: localize(`${confirmMove}.cancel`) },
			rejectClose: false,
		});

		if (confirmed !== true) return;
	}

	// Deduct action pip (will go negative if forced)
	await combatant!.update({
		'system.actions.base.current': actionsRemaining - 1,
	} as Record<string, unknown>);

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

	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.defend.label');

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
		);
		return;
	}
	const confirmed = await checkReactionConfirmation(actor, ['defend'], reactionName);
	if (!confirmed) return;

	const reactionUsed = await combat.useHeroicReactions(combatantId, ['defend'], { force: true });
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

	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.interpose.label');

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
		);
		return;
	}
	const confirmed = await checkReactionConfirmation(actor, ['interpose'], reactionName);
	if (!confirmed) return;

	const reactionUsed = await combat.useHeroicReactions(combatantId, ['interpose'], { force: true });
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

	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm');

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
		);
		return;
	}
	const confirmed = await checkReactionConfirmation(actor, ['interpose', 'defend'], reactionName);
	if (!confirmed) return;

	const reactionUsed = await combat.useHeroicReactions(combatantId, ['interpose', 'defend'], {
		force: true,
	});
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

async function executeHelpReaction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const combatantId = combatant?.id ?? combatant?._id ?? null;

	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.help.label');

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
		);
		return;
	}
	const confirmed = await checkReactionConfirmation(actor, ['help'], reactionName);
	if (!confirmed) return;

	const reactionUsed = await combat.useHeroicReactions(combatantId, ['help'], { force: true });
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
			reactionType: 'help',
			targets: targetUuids,
		},
	} as unknown as ChatMessage.CreateData);
}

async function executeOpportunityAttackReaction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const combatantId = combatant?.id ?? combatant?._id ?? null;

	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.opportunity.label');

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
		);
		return;
	}
	const confirmed = await checkReactionConfirmation(actor, ['opportunityAttack'], reactionName);
	if (!confirmed) return;

	// For opportunity attack, we open the sheet to let the user choose a weapon
	// since this requires more user interaction than the simple reactions
	const sheet = actor.sheet as foundry.applications.sheets.ActorSheetV2 & {
		$state: Record<string, unknown>;
	};
	await sheet.render(true);

	const appState = sheet.$state;
	appState.activePrimaryTab = 'actions';
	appState.heroicActionTarget = { actionId: 'opportunity', actionType: 'reaction' };
}

async function executeUnarmedStrike(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const inCombat = combatant?.initiative !== null;

	// Get current actions if in combat
	// @ts-expect-error - combatant.system is not typed
	const actions = combatant?.system?.actions?.base;
	const actionsRemaining = actions?.current ?? 0;

	let rollFormula = getUnarmedDamageFormula(actor);
	const canCrit = hasUnarmedProficiency(actor);

	// Apply melee damage bonus (e.g., Reverberating Strikes)
	const actorSystem = actor.system as {
		meleeDamageBonus?: { value: number; damageType: string };
	};
	const meleeDamageBonus = actorSystem.meleeDamageBonus?.value ?? 0;
	if (meleeDamageBonus > 0) {
		rollFormula = `${rollFormula} + ${meleeDamageBonus}`;
	}

	const unarmedItem = {
		name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
		img: 'icons/skills/melee/unarmed-punch-fist.webp',
		system: {
			activation: {
				effects: [
					{
						type: 'damage',
						formula: rollFormula,
						damageType: 'bludgeoning',
						canCrit,
						canMiss: true,
					},
				],
			},
		},
	};

	const dialog = new ItemActivationConfigDialog(
		actor,
		unarmedItem,
		localize('NIMBLE.ui.heroicActions.unarmedStrike'),
		{ rollMode: 0 },
	);
	await dialog.render(true);
	const result = await dialog.promise;

	if (!result) return;

	const roll = new DamageRoll(rollFormula, actor.getRollData(), {
		canCrit,
		canMiss: true,
		rollMode: result.rollMode ?? 0,
		primaryDieValue: result.primaryDieValue ?? 0,
		primaryDieModifier: Number(result.primaryDieModifier) || 0,
		damageType: 'bludgeoning',
		primaryDieAsDamage: true,
	});

	await roll.evaluate();

	const rollData = roll.toJSON();

	const evaluatedEffects = [
		{
			id: 'unarmed-damage',
			type: 'damage',
			formula: rollFormula,
			damageType: 'bludgeoning',
			canCrit,
			canMiss: true,
			roll: rollData,
			parentNode: null,
			parentContext: null,
			on: {
				hit: [
					{
						id: 'unarmed-damage-hit',
						type: 'damageOutcome',
						parentNode: 'unarmed-damage',
						parentContext: 'hit',
					},
				],
			},
		},
	];

	const chatData = {
		author: game.user?.id,
		flavor: `${actor.name}: ${localize('NIMBLE.ui.heroicActions.unarmedStrike')}`,
		speaker: ChatMessage.getSpeaker({ actor }),
		style: CONST.CHAT_MESSAGE_STYLES.OTHER,
		sound: CONFIG.sounds.dice,
		rolls: [roll],
		system: {
			actorName: actor.name,
			actorType: actor.type,
			image: unarmedItem.img,
			permissions: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
			rollMode: result.rollMode ?? 0,
			name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
			description: '',
			featureType: 'feature',
			class: '',
			attackType: 'reach',
			attackDistance: 1,
			isCritical: roll.isCritical,
			isMiss: roll.isMiss,
			activation: {
				effects: evaluatedEffects,
				cost: { type: 'action', quantity: 1 },
				duration: { type: 'none', quantity: 1 },
				targets: { count: 1 },
			},
			targets: Array.from(game.user?.targets?.map((token) => token.document.uuid) ?? []),
		},
		type: 'feature',
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await ChatMessage.create(chatData as any);

	// Deduct action pip if in combat
	if (inCombat && combatant) {
		await combatant.update({
			'system.actions.base.current': actionsRemaining - 1,
		} as Record<string, unknown>);
	}
}
