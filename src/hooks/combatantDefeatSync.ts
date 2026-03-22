import { getActorHpValue, getActorWoundsValueAndMax } from '../utils/actorResources.js';
import { isCombatantDead } from '../utils/isCombatantDead.js';

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

function getShouldBeDefeatedFromActorState(combatant: Combatant.Implementation): boolean | null {
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

	// Track defeat state for the triggering actor separately
	let triggeringActorShouldBeDefeated: boolean | null = null;

	// Track defeat states for other actors (unlinked tokens have different actor instances)
	const otherActorDefeatStates = new Map<Actor.Implementation, boolean>();

	for (const { combat, combatant } of matches) {
		if (!combat.id || !combatant.id) continue;
		const shouldBeDefeated = getShouldBeDefeatedFromActorState(combatant);
		if (shouldBeDefeated === null) continue;

		const combatantActor = combatant.actor;
		if (!combatantActor) continue;

		// Check if this combatant's actor is the same as the triggering actor
		// For unlinked tokens, combatant.actor should match the actor that triggered the hook
		const isTriggeringActor = combatantActor === actor;

		if (isTriggeringActor) {
			// For linked tokens, use || to ensure defeated if ANY combatant should be defeated
			if (triggeringActorShouldBeDefeated === null) {
				triggeringActorShouldBeDefeated = shouldBeDefeated;
			} else {
				triggeringActorShouldBeDefeated = triggeringActorShouldBeDefeated || shouldBeDefeated;
			}
		} else {
			// Different actor instance (other unlinked tokens of the same base type)
			const currentState = otherActorDefeatStates.get(combatantActor) ?? false;
			otherActorDefeatStates.set(combatantActor, currentState || shouldBeDefeated);
		}

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

	// Toggle status on the triggering actor based on HP state
	// If no combatant matched via identity check, fall back to getting state from the actor directly
	// Wrap in try-catch to handle race conditions with concurrent status effect modifications
	try {
		if (triggeringActorShouldBeDefeated !== null) {
			await actor.toggleStatusEffect(defeatedStatusId, {
				overlay: true,
				active: triggeringActorShouldBeDefeated,
			});
		} else if (matches.length > 0) {
			// Fallback: identity check failed for all combatants, but we have matches
			// This can happen with synthetic actors where combatant.actor !== actor despite being the same logical actor
			// Use the first matching combatant's state since they should all have the same HP
			const fallbackShouldBeDefeated = getShouldBeDefeatedFromActorState(matches[0].combatant);
			if (fallbackShouldBeDefeated !== null) {
				await actor.toggleStatusEffect(defeatedStatusId, {
					overlay: true,
					active: fallbackShouldBeDefeated,
				});
			}
		}
	} catch {
		// Ignore errors from concurrent status effect modifications
	}

	// Toggle status on other unlinked token actors
	for (const [otherActor, shouldBeDefeated] of otherActorDefeatStates) {
		try {
			await otherActor.toggleStatusEffect(defeatedStatusId, {
				overlay: true,
				active: shouldBeDefeated,
			});
		} catch {
			// Ignore errors from concurrent status effect modifications
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
		const hpChanged = foundry.utils.hasProperty(changes, 'system.attributes.hp.value');
		const woundsChanged =
			foundry.utils.hasProperty(changes, 'system.attributes.wounds.value') ||
			foundry.utils.hasProperty(changes, 'system.attributes.wounds.max');
		if (!hpChanged && !woundsChanged) return;

		void syncActorCombatantDeathState(actor);
	});

	Hooks.on('createCombatant', (combatant: Combatant.Implementation) => {
		const actor = combatant.actor;
		if (!actor) return;

		void syncActorCombatantDeathState(actor);
	});
}
