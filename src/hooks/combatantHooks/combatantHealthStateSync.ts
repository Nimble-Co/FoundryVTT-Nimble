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
 * Per-actor sync mutex with a dirty-flag re-run pattern. Multiple `updateActor`
 * hook firings (rapid HP edits, cascading hp/effect updates) would otherwise
 * call `toggleStatusEffect` concurrently on the same actor, racing each other
 * to create or delete the same Active Effect — producing duplicate AEs and
 * "AE does not exist" errors when one toggle removes what another is about
 * to remove.
 *
 * While a sync is running for an actor, additional invocations mark the
 * existing run dirty and bail; the in-flight run loops once more so the
 * latest actor state is reflected without losing updates.
 */
const actorSyncState = new Map<string, { running: boolean; dirty: boolean }>();

/**
 * If a soloMonster's HP just hit 0 without the lastStand status, heal them up to
 * the configured Last Stand HP, apply the status, and fire the GM chat card.
 * Returns true when handled — the resulting heal triggers another hook firing
 * which proceeds through normal status sync.
 */
async function tryEnterLastStand(actor: Actor.Implementation): Promise<boolean> {
	if (actor.type !== 'soloMonster') return false;
	if (hasLastStandStatus(actor)) return false;

	const hpValue = getActorHpValue(actor);
	if (hpValue === null || hpValue > 0) return false;

	const lastStandHp = getActorLastStandHp(actor);
	if (lastStandHp === null) return false;

	const hpMax = getActorHpMaxValue(actor);
	const targetHp = hpMax !== null ? Math.min(lastStandHp, hpMax) : lastStandHp;

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
}

async function runSyncOnce(actor: Actor.Implementation): Promise<void> {
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

	// Last Stand is one-way: entry is handled by tryEnterLastStand; never auto-cleared.
	// GMs can manually toggle it off via the token HUD if needed.
}

async function syncActorHealthState(actor: Actor.Implementation): Promise<void> {
	if (!game.user?.isGM) return;
	if (!actor.id) return;

	const existing = actorSyncState.get(actor.id);
	if (existing?.running) {
		existing.dirty = true;
		return;
	}

	const state = { running: true, dirty: false };
	actorSyncState.set(actor.id, state);

	try {
		do {
			state.dirty = false;
			await runSyncOnce(actor);
		} while (state.dirty);
	} finally {
		actorSyncState.delete(actor.id);
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
