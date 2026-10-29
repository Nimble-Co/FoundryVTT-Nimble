import type { NimbleCharacter } from '../documents/actor/character.js';
import { getActiveCombatForCurrentScene } from '../utils/combat/combatState.js';
import { runMoveAction } from '../utils/heroicActions/move.js';
import {
	checkReactionConfirmation,
	isChatReactionId,
	useChatReaction,
} from '../utils/heroicActions/reactions.js';
import { strikeUnarmed } from '../utils/heroicActions/unarmedStrike.js';
import localize from '../utils/localize.js';
import { heroicRowId } from '../view/actorSheets/hero/heroicRows.js';
import { asRevealable } from '../view/actorSheets/shared/revealable.js';
import type { RevealRequest } from '../view/actorSheets/shared/sheetUiState.js';

/** The deep link opens Actions and the choice step of the row. A spell opens the Spells tab. */
function heroicDeepLink(actionId: string): RevealRequest {
	if (actionId === 'assess' || actionId === 'opportunity') {
		return { tab: 'actions', rowId: heroicRowId(actionId), step: 'choice' };
	}
	return { tab: actionId === 'spell' ? 'spells' : 'actions' };
}

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
		await runMoveAction(actor as NimbleCharacter);
		return;
	}

	// Handle unarmed strike directly
	if (actionId === 'unarmedStrike' && actionType === 'action') {
		await strikeUnarmed(actor as NimbleCharacter);
		return;
	}

	// Handle chat-based reactions (defend, interpose, interposeAndDefend, help)
	if (actionType === 'reaction' && isChatReactionId(actionId)) {
		await useChatReaction(actor as NimbleCharacter, actionId);
		return;
	}

	// The new character sheet: the pick in the choice step asks when the reaction is soft-blocked
	const revealable = asRevealable(actor.sheet);
	if (revealable) {
		revealable.reveal(heroicDeepLink(actionId));
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

async function executeOpportunityAttackReaction(actor: NimbleCharacter): Promise<void> {
	const reactionName = localize('NIMBLE.ui.heroicActions.reactions.opportunity.label');

	const combat = getActiveCombatForCurrentScene();
	const combatant = combat?.combatants.find((c) => c.actorId === actor.id);
	if (!combat || !combatant) {
		ui.notifications.warn(
			localize('NIMBLE.ui.heroicActions.macroWarnings.mustBeInCombat', { action: reactionName }),
		);
		return;
	}

	// Confirm with the player if soft-blocked, but don't deduct/spend yet —
	// the panel's weapon click will deduct via activateItem and mark spent.
	const { confirmed, force } = await checkReactionConfirmation(
		actor,
		['opportunityAttack'],
		reactionName,
	);
	if (!confirmed) return;

	// Open the sheet to let the user choose a weapon
	const sheet = actor.sheet as foundry.applications.sheets.ActorSheetV2 & {
		$state: Record<string, unknown>;
	};
	await sheet.render(true);

	const appState = sheet.$state;
	appState.activePrimaryTab = 'actions';
	appState.heroicActionTarget = {
		actionId: 'opportunity',
		actionType: 'reaction',
		force,
	};
}
