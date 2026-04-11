import {
	ACTOR_HP_PATHS,
	ACTOR_WOUNDS_PATHS,
	hasAnyActorChangeAt,
} from '../../utils/actorHpChangePaths.js';
import { getActorHpValue, getActorWoundsValueAndMax } from '../../utils/actorResources.js';
import { isCombatantDead } from '../../utils/isCombatantDead.js';

let didRegisterCombatantDefeatSync = false;

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

function hasAnyOtherAliveCombatant(combat: Combat, currentCombatantId: string | null): boolean {
	return combat.turns.some(
		(combatant) => combatant.id !== currentCombatantId && !isCombatantDead(combatant),
	);
}

function getShouldBeDefeatedFromCombatant(combatant: Combatant.Implementation): boolean | null {
	if (combatant.type === 'character') {
		const wounds = getActorWoundsValueAndMax(combatant.actor);
		if (!wounds) return null;

		return wounds.value >= wounds.max;
	}

	const hpValue = getActorHpValue(combatant.actor);
	if (hpValue === null) return null;

	return hpValue <= 0;
}

function getShouldBeDefeatedFromActor(actor: Actor.Implementation): boolean | null {
	// For characters, use wounds logic
	if (actor.type === 'character') {
		const wounds = getActorWoundsValueAndMax(actor);
		if (!wounds) return null;

		return wounds.value >= wounds.max;
	}

	// For all other actor types (NPCs, monsters, etc.), use HP logic
	const hpValue = getActorHpValue(actor);
	if (hpValue === null) return null;

	return hpValue <= 0;
}

/**
 * Sync death state for a single combatant. Used when a new combatant is created.
 */
async function syncSingleCombatantDeathState(combatant: Combatant.Implementation): Promise<void> {
	if (!game.user?.isGM) return;

	const combat = combatant.parent;
	if (!combat?.id || !combatant.id) return;

	const combatantActor = combatant.actor;
	if (!combatantActor) return;

	const shouldBeDefeated = getShouldBeDefeatedFromCombatant(combatant);
	if (shouldBeDefeated === null) return;

	// Update combatant defeated flag if needed
	if (combatant.defeated !== shouldBeDefeated) {
		await combat.updateEmbeddedDocuments('Combatant', [
			{ _id: combatant.id, defeated: shouldBeDefeated },
		]);
	}

	// Update actor status effect
	try {
		await combatantActor.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, {
			overlay: true,
			active: shouldBeDefeated,
		});
	} catch {
		// Ignore errors from concurrent status effect modifications
	}

	// Advance turn if this combatant just died and is the active combatant
	const isActiveCombatant = combat.combatant?.id === combatant.id;
	if (
		shouldBeDefeated &&
		isActiveCombatant &&
		combat.round > 0 &&
		hasAnyOtherAliveCombatant(combat, combatant.id)
	) {
		await combat.nextTurn();
	}
}

async function syncActorCombatantDeathState(actor: Actor.Implementation): Promise<void> {
	if (!game.user?.isGM) return;
	if (!actor.id) return;

	const matches = getCombatantsForActor(actor.id);

	// If not in combat, still sync the defeated status on the actor directly
	if (matches.length === 0) {
		const shouldBeDefeated = getShouldBeDefeatedFromActor(actor);
		if (shouldBeDefeated !== null) {
			try {
				await actor.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, {
					overlay: true,
					active: shouldBeDefeated,
				});
			} catch {
				// Ignore errors from concurrent status effect modifications
			}
		}
		return;
	}

	const updatesByCombat = new Map<string, { combat: Combat; updates: Record<string, unknown>[] }>();
	const combatsToAdvanceTurn = new Set<Combat>();

	// Track defeat states per actor instance for status effect updates
	const actorDefeatStates = new Map<Actor.Implementation, boolean>();

	// Track whether we found a combatant with matching actor identity
	let foundTriggeringActor = false;

	for (const { combat, combatant } of matches) {
		if (!combat.id || !combatant.id) continue;
		const shouldBeDefeated = getShouldBeDefeatedFromCombatant(combatant);
		if (shouldBeDefeated === null) continue;

		const combatantActor = combatant.actor;
		if (!combatantActor) continue;

		// Check if this combatant's actor is the same instance as the triggering actor
		if (combatantActor === actor) {
			foundTriggeringActor = true;
		}

		// Track defeat state per actor instance
		// For linked tokens, all combatants share the same actor instance
		// For unlinked tokens, each combatant has its own synthetic actor instance
		const currentState = actorDefeatStates.get(combatantActor) ?? false;
		actorDefeatStates.set(combatantActor, currentState || shouldBeDefeated);

		const update: Record<string, unknown> = { _id: combatant.id };
		let hasChanges = false;

		if (combatant.defeated !== shouldBeDefeated) {
			update.defeated = shouldBeDefeated;
			hasChanges = true;
		}
		if (!hasChanges) continue;

		if (!updatesByCombat.has(combat.id)) {
			updatesByCombat.set(combat.id, { combat, updates: [] });
		}
		updatesByCombat.get(combat.id)?.updates.push(update);

		const isActiveCombatant = combat.combatant?.id === combatant.id;
		if (
			shouldBeDefeated &&
			isActiveCombatant &&
			combat.round > 0 &&
			hasAnyOtherAliveCombatant(combat, combatant.id)
		) {
			combatsToAdvanceTurn.add(combat);
		}
	}

	for (const { combat, updates } of updatesByCombat.values()) {
		if (updates.length > 0) {
			await combat.updateEmbeddedDocuments('Combatant', updates);
		}
	}

	const defeatedStatusId = CONFIG.specialStatusEffects.DEFEATED;

	// Toggle status on each combatant's actor based on its HP state
	for (const [actorInstance, shouldBeDefeated] of actorDefeatStates) {
		try {
			await actorInstance.toggleStatusEffect(defeatedStatusId, {
				overlay: true,
				active: shouldBeDefeated,
			});
		} catch {
			// Ignore errors from concurrent status effect modifications
		}
	}

	// If the triggering actor wasn't found via identity check (can happen with synthetic actors),
	// ensure we still toggle status on it based on its own HP state
	if (!foundTriggeringActor) {
		const triggeringActorShouldBeDefeated = getShouldBeDefeatedFromActor(actor);
		if (triggeringActorShouldBeDefeated !== null) {
			try {
				await actor.toggleStatusEffect(defeatedStatusId, {
					overlay: true,
					active: triggeringActorShouldBeDefeated,
				});
			} catch {
				// Ignore errors from concurrent status effect modifications
			}
		}
	}

	for (const combat of combatsToAdvanceTurn) {
		await combat.nextTurn();
	}
}

export default function registerCombatantDefeatSync() {
	if (didRegisterCombatantDefeatSync) return;
	didRegisterCombatantDefeatSync = true;

	Hooks.on('updateActor', (actor: Actor.Implementation, changes: Record<string, unknown>) => {
		const watched = [ACTOR_HP_PATHS.value, ACTOR_WOUNDS_PATHS.value, ACTOR_WOUNDS_PATHS.max];
		if (!hasAnyActorChangeAt(changes, watched)) return;

		void syncActorCombatantDeathState(actor);
	});

	Hooks.on('createCombatant', (combatant: Combatant.Implementation) => {
		// Use the targeted single-combatant sync to avoid affecting other unlinked tokens
		// that share the same base actor ID but have independent HP
		void syncSingleCombatantDeathState(combatant);
	});
}
