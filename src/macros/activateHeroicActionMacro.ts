import { DamageRoll } from '../dice/DamageRoll.js';
import type { NimbleCharacter } from '../documents/actor/character.js';
import ItemActivationConfigDialog from '../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { getUnarmedDamageFormula, hasUnarmedProficiency } from '../utils/attackUtils.js';
import { getActiveCombatForCurrentScene } from '../utils/combatState.js';
import { getHeroicReactionUsageState } from '../utils/getHeroicReactionUsageState.js';
import {
	getHeroicReactionAvailability,
	getHeroicReactionLabel,
	type HeroicReactionKey,
} from '../utils/heroicActions.js';
import localize from '../utils/localize.js';
import { getMovementSpeeds } from '../utils/movementSpeeds.js';
import showReactionConfirmation from '../utils/showReactionConfirmation.js';
import { getTargetedTokens } from '../utils/targeting.js';

type CombatWithHeroicReactionUse = Combat & {
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: HeroicReactionKey[],
		options?: { force?: boolean },
	) => Promise<boolean>;
};

type ReactionConfirmationResult = {
	confirmed: boolean;
	force: boolean;
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

	// Handle chat-based reactions (defend, interpose, interposeAndDefend, help)
	const reactionConfig = actionType === 'reaction' ? REACTION_CONFIGS[actionId] : undefined;
	if (reactionConfig) {
		await executeChatReaction(actor as NimbleCharacter, reactionConfig);
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
): Promise<ReactionConfirmationResult> {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);

	if (!combat || !combatant) return { confirmed: true, force: false };

	const usageState = getHeroicReactionUsageState({
		combat,
		combatant,
		reactionKeys,
	});

	// Only show confirmation for 'noActions' or 'spent' blocked reasons
	if (usageState.blockedReason !== 'noActions' && usageState.blockedReason !== 'spent') {
		return { confirmed: true, force: false };
	}

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

	return {
		confirmed: await showReactionConfirmation({
			reactionName,
			spentReactionNames,
			noActions,
			hasSpentReactions,
		}),
		force: true,
	};
}

/**
 * Resolves combat state, confirms the reaction with the user if needed,
 * and uses the heroic reaction. Returns { force } on success, or null if
 * the reaction should not proceed.
 */
async function resolveAndUseReaction(
	actor: NimbleCharacter,
	reactionKeys: HeroicReactionKey[],
	reactionName: string,
): Promise<{ force: boolean } | null> {
	const combat = getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const combatantId = combatant?.id ?? combatant?._id ?? null;

	if (!combat?.useHeroicReactions || !combatantId) {
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
		);
		return null;
	}

	const { confirmed, force } = await checkReactionConfirmation(actor, reactionKeys, reactionName);
	if (!confirmed) return null;

	const reactionUsed = await combat.useHeroicReactions(
		combatantId,
		reactionKeys,
		force ? { force: true } : undefined,
	);
	if (!reactionUsed) return null;

	return { force };
}

/**
 * Builds the common chat message data for a reaction.
 */
function buildReactionChatData(
	actor: NimbleCharacter,
	reactionType: string,
	system: Record<string, unknown>,
): unknown {
	return {
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		type: 'reaction',
		system: {
			actorName: actor.name,
			actorType: actor.type,
			image: actor.img,
			permissions: actor.permission,
			rollMode: 0,
			reactionType,
			...system,
		},
	};
}

async function executeMoveAction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const inCombat = !!combatant && combatant.initiative !== null;

	if (!inCombat) {
		const actionName = localize('NIMBLE.ui.heroicActions.actions.move.label');
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: actionName }),
		);
		return;
	}

	// Get current actions
	// @ts-expect-error - combatant.system is not typed
	const actions = combatant.system?.actions?.base;
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

	// Deduct action pip (clamp at 0)
	await combatant.update({
		'system.actions.base.current': Math.max(0, actionsRemaining - 1),
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

interface ReactionChatConfig {
	reactionKeys: HeroicReactionKey[];
	localizationKey: string;
	messages: Array<{
		type: string;
		buildSystem: (actor: NimbleCharacter, targetUuids: string[]) => Record<string, unknown>;
	}>;
}

const REACTION_CONFIGS: Record<string, ReactionChatConfig> = {
	defend: {
		reactionKeys: ['defend'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.defend.label',
		messages: [
			{
				type: 'defend',
				buildSystem: (actor) => ({
					armorValue: actor.reactive.system.attributes.armor.value ?? 0,
					targets: [],
				}),
			},
		],
	},
	interpose: {
		reactionKeys: ['interpose'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.interpose.label',
		messages: [
			{
				type: 'interpose',
				buildSystem: (_, targetUuids) => ({ targets: targetUuids }),
			},
		],
	},
	interposeAndDefend: {
		reactionKeys: ['interpose', 'defend'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm',
		messages: [
			{
				type: 'interpose',
				buildSystem: (_, targetUuids) => ({ targets: targetUuids }),
			},
			{
				type: 'defend',
				buildSystem: (actor) => ({
					armorValue: actor.reactive.system.attributes.armor.value ?? 0,
					targets: [],
				}),
			},
		],
	},
	help: {
		reactionKeys: ['help'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.help.label',
		messages: [
			{
				type: 'help',
				buildSystem: (_, targetUuids) => ({ targets: targetUuids }),
			},
		],
	},
};

async function executeChatReaction(
	actor: NimbleCharacter,
	config: ReactionChatConfig,
): Promise<void> {
	const reactionName = localize(config.localizationKey);
	if (!(await resolveAndUseReaction(actor, config.reactionKeys, reactionName))) return;

	const targetUuids = getTargetedTokens(actor.id ?? '').map((t) => t.document.uuid);

	for (const msg of config.messages) {
		await ChatMessage.create(
			buildReactionChatData(
				actor,
				msg.type,
				msg.buildSystem(actor, targetUuids),
			) as ChatMessage.CreateData,
		);
	}
}

async function executeOpportunityAttackReaction(actor: NimbleCharacter): Promise<void> {
	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.opportunity.label');
	const result = await resolveAndUseReaction(actor, ['opportunityAttack'], reactionName);
	if (!result) return;

	// For opportunity attack, we open the sheet to let the user choose a weapon
	// since this requires more user interaction than the simple reactions
	const sheet = actor.sheet as foundry.applications.sheets.ActorSheetV2 & {
		$state: Record<string, unknown>;
	};
	await sheet.render(true);

	const appState = sheet.$state;
	appState.activePrimaryTab = 'actions';
	appState.heroicActionTarget = {
		actionId: 'opportunity',
		actionType: 'reaction',
		force: result.force,
	};
}

async function executeUnarmedStrike(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const inCombat = !!combatant && combatant.initiative !== null;

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

	const targetUuids = getTargetedTokens(actor.id ?? '').map((t) => t.document.uuid);

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
			targets: targetUuids,
		},
		type: 'feature',
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await ChatMessage.create(chatData as any);

	// Deduct action pip if in combat
	if (inCombat && combatant) {
		await combatant.update({
			'system.actions.base.current': Math.max(0, actionsRemaining - 1),
		} as Record<string, unknown>);
	}
}
