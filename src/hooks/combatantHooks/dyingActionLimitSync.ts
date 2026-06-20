import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';
import { getCombatantAdditionalActions } from '../../documents/combat/combatantSystem.js';
import { DYING_MAX_ACTIONS } from '../../utils/actorHealthState.js';
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
 * more actions available than the Dying limit allows. The base action max is limited
 * to {@link DYING_MAX_ACTIONS} while Dying, but already-granted additional actions
 * still apply — so clamp `current` down to `DYING_MAX_ACTIONS + additional` so the
 * action tracker and any action-spend checks immediately reflect the rule.
 */
async function clampDyingActorActions(actor: Actor.Implementation): Promise<void> {
	if (!game.user?.isGM) return;
	if (!actor.id) return;

	for (const { combat, combatant } of getCombatantsForActor(actor.id)) {
		if (!combat.id || !combatant.id) continue;

		const current = getCombatantCurrentActions(combatant);
		const additional = getCombatantAdditionalActions(combatant);
		const cappedActions = DYING_MAX_ACTIONS + additional;
		if (current <= cappedActions) continue;

		await combat.updateEmbeddedDocuments('Combatant', [
			{
				_id: combatant.id,
				'system.actions.base.current': cappedActions,
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
