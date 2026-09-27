import { isMovementTrackingAutomationEnabled } from '../settings/automationSettings.js';

let didRegister = false;

function refreshActor(actor: Actor | null | undefined): void {
	if (!actor) return;
	actor.reset();
	actor.render(false);
}

function refreshCombatantActors(combat: Combat): void {
	const actors = new Set<Actor>();
	for (const combatant of combat.combatants) {
		if (combatant.actor) actors.add(combatant.actor);
	}
	for (const actor of actors) refreshActor(actor);
}

/**
 * Re-prepares every combatant actor in a started combat, so the Spaces Moved
 * This Turn tag follows a change of the Movement Tracking toggle.
 */
export function refreshMovementTrackedActors(): void {
	for (const combat of game.combats ?? []) {
		if (combat.started) refreshCombatantActors(combat);
	}
}

/**
 * Re-prepares actors on every client whenever the Spaces Moved This Turn tag can
 * change: Foundry records or clears a token's movement history, a combat starts
 * or ends, or a combatant joins or leaves a started combat.
 */
export default function registerMovementHistoryRefresh(): void {
	if (didRegister) return;
	didRegister = true;

	Hooks.on('recordToken', (tokenDocument) => {
		if (!isMovementTrackingAutomationEnabled()) return;
		refreshActor(tokenDocument.actor);
	});

	// Each turn start refreshes its own actor through `recordToken`, so a round
	// change refreshes them all only when it starts or ends the combat.
	Hooks.on('updateCombat', (combat, changed) => {
		if (!isMovementTrackingAutomationEnabled()) return;
		if (!('round' in changed)) return;
		const wasStarted = (combat.previous?.round ?? 0) > 0;
		if (wasStarted === combat.started) return;
		refreshCombatantActors(combat);
	});

	Hooks.on('createCombat', (combat) => {
		if (!isMovementTrackingAutomationEnabled() || !combat.started) return;
		refreshCombatantActors(combat);
	});

	Hooks.on('deleteCombat', (combat) => {
		if (!isMovementTrackingAutomationEnabled() || !combat.started) return;
		refreshCombatantActors(combat);
	});

	Hooks.on('createCombatant', (combatant) => {
		if (!isMovementTrackingAutomationEnabled() || !combatant.parent?.started) return;
		refreshActor(combatant.actor);
	});

	Hooks.on('deleteCombatant', (combatant) => {
		if (!isMovementTrackingAutomationEnabled() || !combatant.parent?.started) return;
		refreshActor(combatant.actor);
	});
}
