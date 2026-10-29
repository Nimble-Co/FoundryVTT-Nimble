import type { NimbleCharacter } from '#documents/actor/character.js';
import { getActiveCombatForCurrentScene } from '#utils/combat/combatState.js';
import { getHeroicReactionUsageState } from '#utils/incomingReactions/getHeroicReactionUsageState.js';
import {
	getHeroicReactionAvailability,
	getHeroicReactionLabel,
	type HeroicReactionKey,
} from '#utils/incomingReactions/heroicActions.js';
import showReactionConfirmation from '#utils/incomingReactions/showReactionConfirmation.js';
import localize from '#utils/localize.js';
import { getTargetedTokens } from '#utils/tokens/targeting.js';
import { isActionTrackingAutomationEnabled } from '../../settings/automationSettings.js';
import { rollUnarmedStrike } from './unarmedStrike.js';

type CombatWithHeroicReactionUse = Combat & {
	useHeroicReactions?: (
		combatantId: string,
		reactionKeys: HeroicReactionKey[],
		options?: { force?: boolean },
	) => Promise<boolean>;
};

export type ReactionConfirmationResult = {
	confirmed: boolean;
	force: boolean;
};

export type ChatReactionId = 'defend' | 'interpose' | 'interposeAndDefend' | 'help';

interface ReactionChatConfig {
	reactionKeys: HeroicReactionKey[];
	localizationKey: string;
	messages: Array<{
		type: string;
		buildSystem: (actor: NimbleCharacter, targetUuids: string[]) => Record<string, unknown>;
	}>;
}

function findCombatant(actor: NimbleCharacter) {
	const combat = getActiveCombatForCurrentScene() as CombatWithHeroicReactionUse | null;
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	const combatantId = combatant?.id ?? combatant?._id ?? null;
	return { combat, combatant, combatantId };
}

function warnMustBeInCombat(reactionName: string): void {
	ui.notifications.warn(
		localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
	);
}

/**
 * Checks if a reaction requires confirmation due to a soft block (missing actions,
 * already spent this round, or active turn). Shows the confirmation dialog so the
 * player can acknowledge and bypass it. Returns true if the reaction can proceed.
 */
export async function checkReactionConfirmation(
	actor: NimbleCharacter,
	reactionKeys: HeroicReactionKey[],
	reactionName: string,
): Promise<ReactionConfirmationResult> {
	const { combat, combatant } = findCombatant(actor);

	if (!combat || !combatant) return { confirmed: true, force: false };

	const usageState = getHeroicReactionUsageState({
		combat,
		combatant,
		reactionKeys,
	});

	// Only show confirmation for soft block reasons that the player can bypass
	const softBlockReasons: ReadonlySet<string> = new Set(['noActions', 'spent', 'activeTurn']);
	if (usageState.blockedReason === null || !softBlockReasons.has(usageState.blockedReason)) {
		return { confirmed: true, force: false };
	}

	const noActions =
		usageState.blockedReason === 'noActions' ||
		(isActionTrackingAutomationEnabled() && usageState.currentActions < usageState.requiredActions);
	const isActiveTurn = usageState.isActiveTurn;

	const spentReactions = reactionKeys.filter(
		(key) => !getHeroicReactionAvailability(combatant, key),
	);
	const hasSpentReactions = spentReactions.length > 0;
	const spentReactionNames = spentReactions.map((key) => getHeroicReactionLabel(key)).join(' & ');

	return {
		confirmed: await showReactionConfirmation({
			reactionName,
			spentReactionNames,
			noActions,
			hasSpentReactions,
			isActiveTurn,
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
	const { combat, combatantId } = findCombatant(actor);

	if (!combat?.useHeroicReactions || !combatantId) {
		warnMustBeInCombat(reactionName);
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

/** Builds the common chat message data for a reaction. */
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

const defendMessage = {
	type: 'defend',
	buildSystem: (actor: NimbleCharacter) => ({
		armorValue: actor.reactive.system.attributes.armor.value ?? 0,
		targets: [],
	}),
};

function targetedMessage(type: string) {
	return {
		type,
		buildSystem: (_: NimbleCharacter, targetUuids: string[]) => ({ targets: targetUuids }),
	};
}

const REACTION_CONFIGS: Record<ChatReactionId, ReactionChatConfig> = {
	defend: {
		reactionKeys: ['defend'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.defend.label',
		messages: [defendMessage],
	},
	interpose: {
		reactionKeys: ['interpose'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.interpose.label',
		messages: [targetedMessage('interpose')],
	},
	interposeAndDefend: {
		reactionKeys: ['interpose', 'defend'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm',
		messages: [targetedMessage('interpose'), defendMessage],
	},
	help: {
		reactionKeys: ['help'],
		localizationKey: 'NIMBLE.ui.heroicActions.reactions.help.label',
		messages: [targetedMessage('help')],
	},
};

export function isChatReactionId(value: string): value is ChatReactionId {
	return Object.hasOwn(REACTION_CONFIGS, value);
}

async function executeChatReaction(
	actor: NimbleCharacter,
	config: ReactionChatConfig,
): Promise<boolean> {
	const reactionName = localize(config.localizationKey);
	if (!(await resolveAndUseReaction(actor, config.reactionKeys, reactionName))) return false;

	const targetUuids = getTargetedTokens(actor.id ?? '').map((t) => t.document.uuid ?? '');

	for (const msg of config.messages) {
		await ChatMessage.create(
			buildReactionChatData(
				actor,
				msg.type,
				msg.buildSystem(actor, targetUuids),
			) as ChatMessage.CreateData,
		);
	}
	return true;
}

/**
 * Uses a chat-card reaction (Defend, Interpose, both, or Help): confirms a soft
 * block, marks the reaction spent and posts its cards. Returns true when used.
 */
export async function useChatReaction(
	actor: NimbleCharacter,
	reaction: ChatReactionId,
): Promise<boolean> {
	return executeChatReaction(actor, REACTION_CONFIGS[reaction]);
}

/**
 * Makes an Opportunity Attack with a weapon, or unarmed when `weaponId` is
 * null, at disadvantage by default. The reaction is used only after the roll.
 * Returns true when the reaction was used.
 */
export async function useOpportunityAttack(
	actor: NimbleCharacter,
	weaponId: string | null,
): Promise<boolean> {
	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.opportunity.label');
	const { combat, combatantId } = findCombatant(actor);
	if (!combat || !combatantId) {
		warnMustBeInCombat(reactionName);
		return false;
	}

	const { confirmed, force } = await checkReactionConfirmation(
		actor,
		['opportunityAttack'],
		reactionName,
	);
	if (!confirmed) return false;

	const rolled = weaponId
		? Boolean(await actor.activateItem(weaponId, { rollMode: -1, skipActionDeduction: true }))
		: await rollUnarmedStrike(actor, { rollMode: -1 });
	if (!rolled || !combat.useHeroicReactions) return false;

	return combat.useHeroicReactions(
		combatantId,
		['opportunityAttack'],
		force ? { force: true } : undefined,
	);
}
