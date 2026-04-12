import { isActorBloodied } from '#utils/actorHealthState.js';
import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';

const bloodiedThisEncounter = new Map<string, Set<string>>();

let registered = false;

export function registerBloodiedTriggerHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('combatStart', (combat: Combat) => {
		if (!combat.id) return;
		bloodiedThisEncounter.set(combat.id, new Set());
	});

	Hooks.on('deleteCombat', (combat: Combat) => {
		if (!combat.id) return;
		bloodiedThisEncounter.delete(combat.id);
	});

	Hooks.on('updateActor', (actor: Actor.Implementation, changes: Record<string, unknown>) => {
		if (actor.type !== 'character') return;

		const hpChanged =
			foundry.utils.hasProperty(changes, 'system.attributes.hp.value') ||
			foundry.utils.hasProperty(changes, 'system.attributes.hp.max');
		if (!hpChanged) return;

		const combat = game.combat;
		if (!combat?.started || !combat.id) return;

		const encounterBloodied = bloodiedThisEncounter.get(combat.id);
		if (!encounterBloodied) return;
		if (encounterBloodied.has(actor.id ?? '')) return;

		if (!isActorBloodied(actor)) return;

		encounterBloodied.add(actor.id ?? '');
		void applyRecoveryToActorIfEligible(actor as CharacterActorLike, 'onBloodied');
	});
}
