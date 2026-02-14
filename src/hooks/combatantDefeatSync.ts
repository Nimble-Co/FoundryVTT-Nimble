import { getActorHpValue, isCombatantDead } from '../utils/isCombatantDead.js';

type CombatantWithActions = Combatant.Implementation & {
	system: {
		actions?: {
			base?: {
				current?: number;
				max?: number;
			};
		};
	};
};

let didRegisterCombatantDefeatSync = false;

function getCombatantsForActor(
	actorId: string,
): Array<{ combat: Combat; combatant: CombatantWithActions }> {
	const entries: Array<{ combat: Combat; combatant: CombatantWithActions }> = [];

	for (const combat of game.combats?.contents ?? []) {
		for (const combatant of combat.combatants.contents) {
			if (combatant.actorId !== actorId) continue;
			entries.push({ combat, combatant: combatant as CombatantWithActions });
		}
	}

	return entries;
}

function getCombatantActionMax(combatant: CombatantWithActions): number {
	const maxActions = Number(combatant.system?.actions?.base?.max ?? 0);
	return Number.isFinite(maxActions) && maxActions >= 0 ? maxActions : 0;
}

function getCombatantActionCurrent(combatant: CombatantWithActions): number {
	const currentActions = Number(combatant.system?.actions?.base?.current ?? 0);
	return Number.isFinite(currentActions) && currentActions >= 0 ? currentActions : 0;
}

function hasAnyOtherAliveCombatant(combat: Combat, currentCombatantId: string | null): boolean {
	return combat.turns.some(
		(combatant) => combatant.id !== currentCombatantId && !isCombatantDead(combatant),
	);
}

async function syncActorCombatantDeathState(actor: Actor.Implementation): Promise<void> {
	if (!game.user?.isGM) return;
	if (!actor.id) return;

	const hpValue = getActorHpValue(actor);
	if (hpValue === null) return;

	const shouldBeDefeated = hpValue <= 0;
	const matches = getCombatantsForActor(actor.id);
	if (matches.length === 0) return;

	const updatesByCombat = new Map<string, { combat: Combat; updates: Record<string, unknown>[] }>();
	const combatsToAdvanceTurn = new Set<Combat>();

	for (const { combat, combatant } of matches) {
		if (!combat.id || !combatant.id) continue;

		const update: Record<string, unknown> = { _id: combatant.id };
		let hasChanges = false;

		if (combatant.defeated !== shouldBeDefeated) {
			update.defeated = shouldBeDefeated;
			hasChanges = true;
		}

		const actionCurrent = getCombatantActionCurrent(combatant);
		const actionMax = getCombatantActionMax(combatant);
		const desiredActions = shouldBeDefeated ? 0 : actionMax;

		if (actionCurrent !== desiredActions) {
			update['system.actions.base.current'] = desiredActions;
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
	await actor.toggleStatusEffect(defeatedStatusId, {
		overlay: true,
		active: shouldBeDefeated,
	});

	for (const combat of combatsToAdvanceTurn) {
		await combat.nextTurn();
	}
}

export default function registerCombatantDefeatSync() {
	if (didRegisterCombatantDefeatSync) return;
	didRegisterCombatantDefeatSync = true;

	Hooks.on('updateActor', (actor: Actor.Implementation, changes: Record<string, unknown>) => {
		const hpChanged = foundry.utils.hasProperty(changes, 'system.attributes.hp.value');
		if (!hpChanged) return;

		void syncActorCombatantDeathState(actor);
	});

	Hooks.on('createCombatant', (combatant: Combatant.Implementation) => {
		const actor = combatant.actor;
		if (!actor) return;

		void syncActorCombatantDeathState(actor);
	});
}
