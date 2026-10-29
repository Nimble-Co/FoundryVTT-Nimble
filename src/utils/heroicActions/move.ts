import type { NimbleCharacter } from '#documents/actor/character.js';
import { getMovementSpeeds } from '#utils/actor/movementSpeeds.js';
import { getActiveCombatForCurrentScene } from '#utils/combat/combatState.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import localize from '#utils/localize.js';

/**
 * Takes the Move action in combat: confirms when no actions remain, spends 1
 * action and posts the move card with the walk speed.
 */
export async function runMoveAction(actor: NimbleCharacter): Promise<void> {
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

	// @ts-expect-error - combatant.system is not typed
	const actions = combatant.system?.actions?.base;
	const actionsRemaining = actions?.current ?? 0;

	if (actionsRemaining <= 0) {
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

	if (combat && combatant.id) {
		await consumeCombatantAction({ combat, combatantId: combatant.id });
	}

	const movementSpeeds = getMovementSpeeds(actor);
	const primarySpeed = movementSpeeds.find((s) => s.type === 'walk') ?? movementSpeeds[0];

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
