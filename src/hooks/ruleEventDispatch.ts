import { systemHookName } from '#system';
import type {
	ActorDyingContext,
	ActorHealthContext,
	EncounterEndContext,
	InitiativeRolledContext,
	ItemActivatedContext,
	ItemUsedContext,
	NimbleBaseRule,
	RestContext,
	RoundChangedContext,
	SaveResolvedContext,
	TurnContext,
} from '../models/rules/base.js';
import { getActorHealthState } from '../utils/actorHealthState.js';
import {
	ACTOR_HP_PATHS,
	ACTOR_WOUNDS_PATHS,
	hasAnyActorChangeAt,
} from '../utils/actorHpChangePaths.js';
import { getActorWoundsValueAndMax } from '../utils/actorResources.js';
import { AUTO_APPLY_CONDITIONS_SETTING, isAutoApplyEnabled } from '../utils/isAutoApplyEnabled.js';

const DYING_STATUS_ID = 'dying';

interface ActorWithRules {
	rules?: NimbleBaseRule[];
}

interface ItemWithActor {
	actor: ActorWithRules | null;
}

interface NimbleDamageAppliedPayload {
	sourceItem: unknown;
	sourceActor: ActorWithRules;
	targetActor: ActorWithRules;
	card: ChatMessage | null;
	isCritical: boolean;
	isMiss: boolean;
}

interface NimbleSavePayload {
	actor: ActorWithRules;
	saveType: string;
	outcome: 'pass' | 'fail';
}

interface NimbleRestPayload {
	actor: ActorWithRules;
	restType: 'safe' | 'field';
}

interface NimbleInitiativePayload {
	actor: ActorWithRules;
	combatant: Combatant;
}

interface NimbleConditionAppliedPayload {
	target: ActorWithRules;
	condition: string;
	effect: unknown;
	source: unknown;
	rule: unknown;
}

async function dispatch<TContext>(
	actor: ActorWithRules | null | undefined,
	methodName: keyof NimbleBaseRule,
	context: TContext,
): Promise<void> {
	if (!actor?.rules) return;
	for (const rule of actor.rules) {
		const method = rule[methodName] as ((ctx: TContext) => Promise<void>) | undefined;
		if (typeof method !== 'function') continue;
		try {
			await method.call(rule, context);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn(`Nimble | ruleEventDispatch ${String(methodName)} failed`, error);
		}
	}
}

function handleDamageApplied(payload: NimbleDamageAppliedPayload): void {
	if (!isAutoApplyEnabled()) return;
	if (!payload.sourceActor || !payload.targetActor) return;
	const context: ItemUsedContext = {
		sourceItem: payload.sourceItem as unknown as ItemUsedContext['sourceItem'],
		sourceActor: payload.sourceActor as unknown as ItemUsedContext['sourceActor'],
		targetActor: payload.targetActor as unknown as ItemUsedContext['targetActor'],
		card: payload.card,
		isCritical: payload.isCritical,
		isMiss: payload.isMiss,
	};
	void dispatch(payload.sourceActor, 'onItemUsed', context);
}

// Registered for BOTH the combatTurn and combatRound workflow hooks: a turn
// advance that wraps to a new round fires only combatRound (Combat#nextTurn
// delegates to nextRound), so without the second registration the last
// combatant in initiative would never receive onTurnEnd and the first would
// never receive onTurnStart.
function handleCombatTurn(
	combat: Combat,
	updateData: { round: number; turn: number | null },
	updateOptions: { direction?: number },
): void {
	if (!isAutoApplyEnabled()) return;
	if (!combat?.turns?.length) return;
	// Backwards navigation undoes turns rather than ending them; core runs
	// no turn lifecycle events for rewinds and neither do we.
	if (updateOptions?.direction === -1) return;

	const previousCombatant = combat.combatant ?? null;
	const previousActor = (previousCombatant?.actor ?? null) as ActorWithRules | null;
	if (previousCombatant && previousActor) {
		const endContext: TurnContext = {
			combat,
			combatant: previousCombatant,
			actor: previousActor as unknown as TurnContext['actor'],
		};
		void dispatch(previousActor, 'onTurnEnd', endContext);
	}

	const nextCombatant = updateData.turn === null ? null : (combat.turns[updateData.turn] ?? null);
	const nextActor = (nextCombatant?.actor ?? null) as ActorWithRules | null;
	if (nextCombatant && nextActor) {
		const startContext: TurnContext = {
			combat,
			combatant: nextCombatant,
			actor: nextActor as unknown as TurnContext['actor'],
		};
		void dispatch(nextActor, 'onTurnStart', startContext);
	}
}

function handleActorUpdate(actor: Actor.Implementation, changes: Record<string, unknown>): void {
	if (!isAutoApplyEnabled()) return;
	const hpChanged = hasAnyActorChangeAt(changes, [ACTOR_HP_PATHS.value]);
	// Death can arrive via a wounds-only update: a dying PC at 0 HP gains
	// their final wound without the HP value moving at all.
	const woundsChanged = hasAnyActorChangeAt(changes, [ACTOR_WOUNDS_PATHS.value]);
	if (!hpChanged && !woundsChanged) return;

	const typedActor = actor as unknown as Actor.Implementation & {
		system: { attributes: { hp: { value: number } } };
	};
	const currentHp = typedActor.system.attributes.hp.value ?? 0;

	const actorWithRules = actor as unknown as ActorWithRules;
	const healthContext: ActorHealthContext = {
		actor: actor as unknown as ActorHealthContext['actor'],
		previousHp: currentHp,
		currentHp,
	};

	if (currentHp <= 0) {
		// Dropping to 0 HP alone means dying, not dead. An actor is killed only
		// at 0 HP with a full wound track; actors without a wound track (NPCs)
		// die at 0 HP outright.
		const wounds = getActorWoundsValueAndMax(actor);
		const isDead = !wounds || wounds.value >= wounds.max;
		if (isDead) {
			void dispatch(actorWithRules, 'onActorKilled', healthContext);
		} else if (hpChanged) {
			// Only an HP drop signals entering the Dying state; a wound gained
			// while already dying must not re-fire it.
			const dyingContext: ActorDyingContext = {
				actor: actor as unknown as ActorDyingContext['actor'],
				source: null,
			};
			void dispatch(actorWithRules, 'onActorDying', dyingContext);
		}
		return;
	}

	if (!hpChanged) return;
	const healthState = getActorHealthState(actor);
	if (healthState === 'bloodied' || healthState === 'lastStand') {
		void dispatch(actorWithRules, 'onActorWounded', healthContext);
	}
}

function handleSaveResolved(payload: NimbleSavePayload): void {
	if (!isAutoApplyEnabled()) return;
	const context: SaveResolvedContext = {
		actor: payload.actor as unknown as SaveResolvedContext['actor'],
		saveType: payload.saveType,
		outcome: payload.outcome,
	};
	void dispatch(payload.actor, 'onSaveResolved', context);
}

function handleRest(payload: NimbleRestPayload): void {
	if (!isAutoApplyEnabled()) return;
	const context: RestContext = {
		actor: payload.actor as unknown as RestContext['actor'],
		restType: payload.restType,
	};
	void dispatch(payload.actor, 'onRest', context);
}

function handleInitiativeRolled(payload: NimbleInitiativePayload): void {
	if (!isAutoApplyEnabled()) return;
	const context: InitiativeRolledContext = {
		actor: payload.actor as unknown as InitiativeRolledContext['actor'],
		combatant: payload.combatant,
	};
	void dispatch(payload.actor, 'onInitiativeRolled', context);
}

function handleUseItem(
	item: ItemWithActor | null,
	card: ChatMessage | null,
	_context: unknown,
): void {
	if (!isAutoApplyEnabled()) return;
	const sourceActor = item?.actor ?? null;
	if (!sourceActor) return;
	const activatedContext: ItemActivatedContext = {
		sourceItem: item as unknown as ItemActivatedContext['sourceItem'],
		sourceActor: sourceActor as unknown as ItemActivatedContext['sourceActor'],
		card,
	};
	void dispatch(sourceActor, 'onItemActivated', activatedContext);
}

// Encounter-end dedup: updateCombat with started:false fires first when the
// GM ends combat normally; deleteCombat fires as fallback (or when combat is
// just deleted from the tracker). The same combat ID can hit both, so we
// record dispatched IDs in updateCombat and clear them inside deleteCombat
// after the dedup check. Same pattern as
// src/hooks/dicePoolTriggers/encounterEndTrigger.ts.
const dispatchedEncounterEndIds = new Set<string>();

function getCombatIdentifier(combat: CombatWithCombatants): string | null {
	if (typeof combat.id !== 'string') return null;
	const trimmed = combat.id.trim();
	return trimmed.length > 0 ? trimmed : null;
}

interface CombatWithCombatants {
	id: string | null | undefined;
	combatants?: { contents?: Array<{ actor?: ActorWithRules | null }> };
}

function dispatchEncounterEnd(combat: CombatWithCombatants): void {
	const combatants = combat.combatants?.contents ?? [];
	for (const combatant of combatants) {
		const actor = combatant.actor ?? null;
		if (!actor) continue;
		const ctx: EncounterEndContext = {
			combat: combat as unknown as Combat,
			actor: actor as unknown as EncounterEndContext['actor'],
		};
		void dispatch(actor, 'onEncounterEnd', ctx);
	}
}

function handleUpdateCombat(combat: CombatWithCombatants, change: Record<string, unknown>): void {
	if (!isAutoApplyEnabled()) return;

	// Round counter changed (turn advance across a boundary, round buttons,
	// or a manual tracker edit, forwards or backwards). Turn hooks do not
	// cover every one of these transitions, so rules with round-stamped
	// state get notified from the document update itself.
	if (typeof change.round === 'number') {
		const combatants = combat.combatants?.contents ?? [];
		for (const combatant of combatants) {
			const actor = combatant.actor ?? null;
			if (!actor) continue;
			const ctx: RoundChangedContext = {
				combat: combat as unknown as Combat,
				actor: actor as unknown as RoundChangedContext['actor'],
				round: change.round,
			};
			void dispatch(actor, 'onRoundChanged', ctx);
		}
	}

	if (change.started !== false) return;
	const combatId = getCombatIdentifier(combat);
	if (combatId && dispatchedEncounterEndIds.has(combatId)) return;
	if (combatId) dispatchedEncounterEndIds.add(combatId);
	dispatchEncounterEnd(combat);
}

function handleDeleteCombat(combat: CombatWithCombatants): void {
	if (!isAutoApplyEnabled()) return;
	const combatId = getCombatIdentifier(combat);
	const alreadyHandled = combatId ? dispatchedEncounterEndIds.has(combatId) : false;
	if (!alreadyHandled) {
		dispatchEncounterEnd(combat);
	}
	if (combatId) dispatchedEncounterEndIds.delete(combatId);
}

function handleConditionApplied(payload: NimbleConditionAppliedPayload): void {
	if (!isAutoApplyEnabled()) return;
	if (payload.condition !== DYING_STATUS_ID) return;
	const targetActor = payload.target;
	if (!targetActor) return;
	const ctx: ActorDyingContext = {
		actor: targetActor as unknown as ActorDyingContext['actor'],
		source: payload.source as ActorDyingContext['source'],
	};
	void dispatch(targetActor, 'onActorDying', ctx);
}

let didRegister = false;

type HookFn = (...args: unknown[]) => void;
const onHook = (event: string, handler: HookFn): number =>
	(Hooks.on as (ev: string, fn: HookFn) => number)(event, handler);

export default function registerRuleEventDispatch(): void {
	if (didRegister) return;
	didRegister = true;

	onHook(systemHookName('damageApplied'), handleDamageApplied as HookFn);
	onHook('combatTurn', handleCombatTurn as HookFn);
	onHook('combatRound', handleCombatTurn as HookFn);
	onHook('updateActor', handleActorUpdate as HookFn);
	onHook(systemHookName('saveResolved'), handleSaveResolved as HookFn);
	onHook(systemHookName('rest'), handleRest as HookFn);
	onHook(systemHookName('initiativeRolled'), handleInitiativeRolled as HookFn);
	onHook(systemHookName('useItem'), handleUseItem as HookFn);
	onHook('updateCombat', handleUpdateCombat as HookFn);
	onHook('deleteCombat', handleDeleteCombat as HookFn);
	onHook(systemHookName('conditionApplied'), handleConditionApplied as HookFn);
}

export {
	AUTO_APPLY_CONDITIONS_SETTING,
	type NimbleSavePayload,
	type NimbleRestPayload,
	type NimbleInitiativePayload,
};
