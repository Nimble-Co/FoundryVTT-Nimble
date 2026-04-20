import type {
	ActorHealthContext,
	InitiativeRolledContext,
	ItemUsedContext,
	NimbleBaseRule,
	RestContext,
	SaveResolvedContext,
	TurnContext,
} from '../models/rules/base.js';
import { getActorHealthState } from '../utils/actorHealthState.js';
import { ACTOR_HP_PATHS, hasAnyActorChangeAt } from '../utils/actorHpChangePaths.js';

const AUTO_APPLY_CONDITIONS_SETTING = 'automation.autoApplyConditions';

interface ActorWithRules {
	rules?: NimbleBaseRule[];
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

function isAutoApplyEnabled(): boolean {
	try {
		return Boolean(
			game.settings?.get('nimble' as 'core', AUTO_APPLY_CONDITIONS_SETTING as 'rollMode'),
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

let didRegister = false;

type HookFn = (...args: unknown[]) => void;
const onHook = (event: string, handler: HookFn): number =>
	(Hooks.on as (ev: string, fn: HookFn) => number)(event, handler);

export default function registerRuleEventDispatch(): void {
	if (didRegister) return;
	didRegister = true;

	onHook('nimble.damageApplied', handleDamageApplied as HookFn);
	onHook('combatTurn', handleCombatTurn as HookFn);
	onHook('updateActor', handleActorUpdate as HookFn);
	onHook('nimble.saveResolved', handleSaveResolved as HookFn);
	onHook('nimble.rest', handleRest as HookFn);
	onHook('nimble.initiativeRolled', handleInitiativeRolled as HookFn);
}

export {
	AUTO_APPLY_CONDITIONS_SETTING,
	type NimbleSavePayload,
	type NimbleRestPayload,
	type NimbleInitiativePayload,
};
