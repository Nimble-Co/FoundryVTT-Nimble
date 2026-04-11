import { getActorHealthState } from '../../utils/actorHealthState.js';
import { ACTOR_HP_PATHS, hasAnyActorChangeAt } from '../../utils/actorHpChangePaths.js';

const BLOODIED_STATUS_ID = 'bloodied';
const LAST_STAND_STATUS_ID = 'lastStand';

let didRegisterCombatantHealthStateSync = false;

async function syncActorHealthState(actor: Actor.Implementation): Promise<void> {
	if (!game.user?.isGM) return;

	const healthState = getActorHealthState(actor);
	const isBloodied = healthState === 'bloodied';
	const isLastStand = healthState === 'lastStand';

	// Wrap in try-catch to handle race conditions with concurrent status effect modifications
	try {
		await actor.toggleStatusEffect(BLOODIED_STATUS_ID, {
			active: isBloodied,
			overlay: false,
		});
	} catch {
		// Ignore errors from concurrent status effect modifications
	}

	try {
		await actor.toggleStatusEffect(LAST_STAND_STATUS_ID, {
			active: isLastStand,
			overlay: false,
		});
	} catch {
		// Ignore errors from concurrent status effect modifications
	}
}

/**
 * Sync health state for a single combatant's actor. Used when a new combatant is created
 * to avoid affecting other unlinked tokens that share the same base actor ID.
 */
async function syncCombatantHealthState(combatant: Combatant.Implementation): Promise<void> {
	const actor = combatant.actor;
	if (!actor) return;

	await syncActorHealthState(actor);
}

export default function registerCombatantHealthStateSync() {
	if (didRegisterCombatantHealthStateSync) return;
	didRegisterCombatantHealthStateSync = true;

	Hooks.on('updateActor', (actor: Actor.Implementation, changes: Record<string, unknown>) => {
		const watched = [ACTOR_HP_PATHS.value, ACTOR_HP_PATHS.max, ACTOR_HP_PATHS.lastStandThreshold];
		if (!hasAnyActorChangeAt(changes, watched)) return;

		void syncActorHealthState(actor);
	});

	Hooks.on('createCombatant', (combatant: Combatant.Implementation) => {
		// Use the combatant's actor directly to avoid cross-contamination
		// between unlinked tokens sharing the same base actor ID
		void syncCombatantHealthState(combatant);
	});
}
