import { SYSTEM_ID, systemHookName } from '#system';
import type {
	ActorHealthContext,
	EncounterEndContext,
	InitiativeRolledContext,
	ItemActivatedContext,
	ItemUsedContext,
	NimbleBaseRule,
	RestContext,
	SaveResolvedContext,
	TurnContext,
	UnconsciousContext,
} from '../models/rules/base.js';
import { getActorHealthState } from '../utils/actorHealthState.js';
import { ACTOR_HP_PATHS, hasAnyActorChangeAt } from '../utils/actorHpChangePaths.js';

const AUTO_APPLY_CONDITIONS_SETTING = 'automation.autoApplyConditions';
const UNCONSCIOUS_STATUS_ID = 'unconscious';

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

function isAutoApplyEnabled(): boolean {
	try {
		return Boolean(
			game.settings?.get(SYSTEM_ID as 'core', AUTO_APPLY_CONDITIONS_SETTING as 'rollMode'),
		);
	} catch {
		return false;
	}
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

function handleCombatTurn(
	combat: Combat,
	updateData: { round: number; turn: number },
	_updateOptions: { advanceTime: number; direction: number },
): void {
	if (!isAutoApplyEnabled()) return;
	if (!combat?.turns?.length) return;

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

	const nextCombatant = combat.turns[updateData.turn] ?? null;
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
	if (!hasAnyActorChangeAt(changes, [ACTOR_HP_PATHS.value])) return;

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
		void dispatch(actorWithRules, 'onActorKilled', healthContext);
		return;
	}

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
// after the dedup check — same pattern as
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
	if (payload.condition !== UNCONSCIOUS_STATUS_ID) return;
	const targetActor = payload.target;
	if (!targetActor) return;
	const ctx: UnconsciousContext = {
		actor: targetActor as unknown as UnconsciousContext['actor'],
		source: payload.source as UnconsciousContext['source'],
	};
	void dispatch(targetActor, 'onUnconscious', ctx);
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
