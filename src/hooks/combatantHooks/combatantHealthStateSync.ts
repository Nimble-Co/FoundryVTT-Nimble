import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';
import { hasLastStandStatus, isActorAtOrBelowHalfHp } from '../../utils/actorHealthState.js';
import { ACTOR_HP_PATHS, hasAnyActorChangeAt } from '../../utils/actorHpChangePaths.js';
import {
	getActorHpMaxValue,
	getActorHpValue,
	getActorLastStandHp,
} from '../../utils/actorResources.js';

let didRegisterCombatantHealthStateSync = false;

type SoloMonsterLike = Actor.Implementation & {
	activateLastStandFeature?: (options: { visibilityMode?: string }) => Promise<unknown>;
};

/**
 * Synchronous re-entry guard. Multiple updateActor hook firings can race past the
 * status check before any of the awaits inside tryEnterLastStand commit, which
 * would otherwise create duplicate Active Effects.
 */
const actorsEnteringLastStand = new Set<string>();

/**
 * If a soloMonster's HP just hit 0 without the lastStand status, heal them up to
 * the configured Last Stand HP, apply the status, and fire the GM chat card.
 * Returns true when handled — the resulting heal triggers another hook firing
 * which proceeds through normal status sync.
 */
async function tryEnterLastStand(actor: Actor.Implementation): Promise<boolean> {
	if (actor.type !== 'soloMonster') return false;
	if (!actor.id) return false;
	if (actorsEnteringLastStand.has(actor.id)) return false;
	if (hasLastStandStatus(actor)) return false;

	const hpValue = getActorHpValue(actor);
	if (hpValue === null || hpValue > 0) return false;

	const lastStandHp = getActorLastStandHp(actor);
	if (lastStandHp === null) return false;

	const hpMax = getActorHpMaxValue(actor);
	const targetHp = hpMax !== null ? Math.min(lastStandHp, hpMax) : lastStandHp;

	actorsEnteringLastStand.add(actor.id);
	try {
		try {
			await actor.update({
				'system.attributes.hp.value': targetHp,
			} as Actor.UpdateData);
		} catch {
			return false;
		}

		try {
			await actor.toggleStatusEffect(STATUS_EFFECT_IDS.lastStand, {
				active: true,
				overlay: false,
			});
		} catch {
			// Ignore — status may already be set or race conditions with concurrent toggles.
		}

		try {
			await actor.toggleStatusEffect(STATUS_EFFECT_IDS.dying, {
				active: true,
				overlay: false,
			});
		} catch {
			// Ignore — status may already be set or race conditions with concurrent toggles.
		}

		const soloMonster = actor as SoloMonsterLike;
		soloMonster.activateLastStandFeature?.({ visibilityMode: 'gmroll' }).catch((error) => {
			console.warn('Nimble | Failed to post Last Stand chat card', error);
		});
		return true;
	} finally {
		actorsEnteringLastStand.delete(actor.id);
	}
}

async function syncActorHealthState(actor: Actor.Implementation): Promise<void> {
	if (!game.user?.isGM) return;

	// May heal HP back up to lastStandHp and apply the lastStand status.
	// We still fall through to the bloodied check so it reflects the post-heal HP.
	await tryEnterLastStand(actor);

	// Bloodied is independent of Last Stand — both can coexist.
	const isBloodied = isActorAtOrBelowHalfHp(actor);
	try {
		await actor.toggleStatusEffect(STATUS_EFFECT_IDS.bloodied, {
			active: isBloodied,
			overlay: false,
		});
	} catch {
		// Ignore errors from concurrent status effect modifications
	}

	// Last Stand is one-way: entry is handled above; never auto-cleared by sync.
	// GMs can manually toggle it off via the token HUD if needed.
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
		const watched = [ACTOR_HP_PATHS.value, ACTOR_HP_PATHS.max, ACTOR_HP_PATHS.lastStandHp];
		if (!hasAnyActorChangeAt(changes, watched)) return;

		void syncActorHealthState(actor);
	});

	Hooks.on('createCombatant', (combatant: Combatant.Implementation) => {
		// Use the combatant's actor directly to avoid cross-contamination
		// between unlinked tokens sharing the same base actor ID
		void syncCombatantHealthState(combatant);
	});
}
