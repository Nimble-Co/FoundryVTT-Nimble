import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';
import { getCombatantAdditionalActions } from '../../documents/combat/combatantSystem.js';
import { getActorDyingActionLimit } from '../../utils/actorHealthState.js';
import { getCombatantCurrentActions } from '../../utils/combatTurnActions.js';

let didRegisterDyingActionLimitSync = false;

function getCombatantsForActor(
	actorId: string,
): Array<{ combat: Combat; combatant: Combatant.Implementation }> {
	const entries: Array<{ combat: Combat; combatant: Combatant.Implementation }> = [];

	for (const combat of game.combats?.contents ?? []) {
		for (const combatant of combat.combatants.contents) {
			if (combatant.actorId !== actorId) continue;
			entries.push({ combat, combatant });
		}
	}

	return entries;
}

/**
 * When an actor gains the Dying condition mid-turn, its combatants may still have
 * more actions available — and additional actions carried over from before Dying —
 * than the Dying limit allows. Clamp `current` down to the actor's Dying action
 * limit (baseline 1, raised by features such as Enduring Rage) and clear those
 * carried-over additional actions so the action tracker and any action-spend checks
 * immediately reflect the rule. The player can still add fresh additional actions
 * afterward while Dying.
 */
async function clampDyingActorActions(actor: Actor.Implementation): Promise<void> {
	if (!game.user?.isGM) return;
	if (!actor.id) return;

	const dyingActionLimit = getActorDyingActionLimit(actor);

	for (const { combat, combatant } of getCombatantsForActor(actor.id)) {
		if (!combat.id || !combatant.id) continue;

		const current = getCombatantCurrentActions(combatant);
		const additional = getCombatantAdditionalActions(combatant);
		if (current <= dyingActionLimit && additional === 0) continue;

		await combat.updateEmbeddedDocuments('Combatant', [
			{
				_id: combatant.id,
				'system.actions.base.current': Math.min(current, dyingActionLimit),
				'system.actions.base.additional': 0,
			} as Record<string, unknown>,
		]);
	}
}

export default function registerDyingActionLimitSync() {
	if (didRegisterDyingActionLimitSync) return;
	didRegisterDyingActionLimitSync = true;

	Hooks.on('createActiveEffect', (effect: ActiveEffect.Implementation) => {
		if (!effect?.parent || effect.parent.documentName !== 'Actor') return;
		if (!(effect.statuses instanceof Set) || !effect.statuses.has(STATUS_EFFECT_IDS.dying)) return;

		void clampDyingActorActions(effect.parent as Actor.Implementation);
	});
}
