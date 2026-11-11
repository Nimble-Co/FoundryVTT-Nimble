import { systemHookName } from '#system';
import { getActorHealthState } from '#utils/actor/actorHealthState.js';
import {
	ACTOR_HP_PATHS,
	ACTOR_WOUNDS_PATHS,
	hasAnyActorChangeAt,
	hpGained,
} from '#utils/actor/actorHpChangePaths.js';
import { getActorWoundsValueAndMax } from '#utils/actor/actorResources.js';
import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { takeBackTempHp } from '#utils/actor/effectTempHp.js';
import { seatOf } from '#utils/lastsUntil/effectSubject.js';
import { endEffects, endEffectsAt } from '#utils/lastsUntil/endEffects.js';
import { effectsInactiveAt } from '#utils/lastsUntil/inactiveRound.js';
import { eventHeading, fireEvent, fireItemUseEvents } from '#utils/lastsUntil/lastsUntilEvents.js';
import localize from '#utils/localize.js';
import { STATUS_EFFECT_IDS } from '../config/registerConditionsConfig.js';

type HookFn = (...args: never[]) => unknown;
const on = (event: string, handler: HookFn) =>
	(Hooks.on as unknown as (ev: string, fn: HookFn) => number)(event, handler);

const isActiveGm = () => !!game.user?.isActiveGM;

interface TurnContext {
	round?: number;
	turn?: number;
}

/** The round of the turn that just ended, when the combat class did not say. */
function roundOfEndedTurn(combat: Combat, combatant: Combatant.Implementation): number {
	const round = Number(combat.round) || 0;
	const index = combat.turns.findIndex((each) => each.id === combatant.id);
	return index > Number(combat.turn ?? 0) ? Math.max(0, round - 1) : round;
}

function onTurn(type: 'turnStart' | 'turnEnd') {
	return (combatant: Combatant.Implementation, context?: TurnContext) => {
		const combat = combatant?.combat as Combat | null;
		if (!isActiveGm() || !combat?.id) return;
		const round =
			context?.round ??
			(type === 'turnEnd' ? roundOfEndedTurn(combat, combatant) : Number(combat.round) || 0);
		const heading = localize(`NIMBLE.lastsUntil.chat.heading.${type}`, {
			name: combatant.name ?? '',
		});
		const seat = seatOf(combatant);
		void endEffectsAt(
			{ type, combatId: combat.id, seat, round, turn: context?.turn ?? null },
			heading,
			combat,
		);
		if (type === 'turnEnd') {
			void endEffects(
				effectsInactiveAt(combat, seat, round),
				eventHeading('inactiveRound', { name: combatant.name }),
			);
		}
	};
}

function onRound(type: 'roundStart' | 'roundEnd') {
	return (combat: Combat, context?: TurnContext) => {
		if (!isActiveGm() || !combat?.id) return;
		const round = context?.round ?? (Number(combat.round) || 0);
		const heading = localize(`NIMBLE.lastsUntil.chat.heading.${type}`, { round: String(round) });
		void endEffectsAt({ type, combatId: combat.id, round }, heading, combat);
	};
}

const endedCombats = new Set<string>();

function endCombat(combat: Combat): void {
	if (!isActiveGm() || !combat?.id || endedCombats.has(combat.id)) return;
	endedCombats.add(combat.id);
	const heading = localize('NIMBLE.lastsUntil.chat.heading.combatEnd');
	void endEffectsAt({ type: 'combatEnd', combatId: combat.id }, heading, combat);
}

/** A core duration can end as combat starts. */
function startCombat(combat: Combat): void {
	if (!isActiveGm() || !combat.id) return;
	endedCombats.delete(combat.id);
	const heading = localize('NIMBLE.lastsUntil.chat.heading.combatStart');
	void endEffectsAt({ type: 'combatStart', combatId: combat.id }, heading, combat);
}

function onUpdateCombat(combat: Combat, changes: Record<string, unknown>): void {
	if (changes.started === false) endCombat(combat);
	if (changes.started === true) startCombat(combat);
}

function onDeleteCombat(combat: Combat): void {
	endCombat(combat);
	if (combat.id) endedCombats.delete(combat.id);
}

function onWorldTime(worldTime: number, delta: number): void {
	if (!isActiveGm() || !(delta > 0)) return;
	const heading = localize('NIMBLE.lastsUntil.chat.heading.worldTime');
	void endEffectsAt({ type: 'worldTime', worldTime }, heading);
}

/** The HP events, read as the rule events read them (`ruleEventDispatch`). */
function onUpdateActor(actor: Actor, changes: Record<string, unknown>, options: unknown): void {
	if (!isActiveGm()) return;
	const hpChanged = hasAnyActorChangeAt(changes, [ACTOR_HP_PATHS.value]);
	const woundsChanged = hasAnyActorChangeAt(changes, [ACTOR_WOUNDS_PATHS.value]);
	if (!hpChanged && !woundsChanged) return;

	const hp = Number(foundry.utils.getProperty(actor, ACTOR_HP_PATHS.value) ?? 0);
	if (hp <= 0) {
		const wounds = getActorWoundsValueAndMax(actor as never);
		const dead = !wounds || wounds.value >= wounds.max;
		if (hpChanged) fireEvent('zeroHp', actor);
		if (dead) fireEvent('die', actor);
		return;
	}
	if (!hpChanged) return;
	if (hpGained(actor, options) > 0) fireEvent('healed', actor);
	const state = getActorHealthState(actor as never);
	if (state === 'bloodied' || state === 'lastStand') fireEvent('wounded', actor);
}

function onUpdateToken(token: TokenDocument, changes: Record<string, unknown>): void {
	if (!isActiveGm() || !('x' in changes || 'y' in changes)) return;
	fireEvent('move', token.actor as Actor | null);
}

/** The user who deleted the effect owns its holder, so the temp HP comes back on that client. */
/** A replaced copy leaves its temp HP to the copy that takes its place. */
function takeBackEffectTempHp(
	effect: ActiveEffect,
	options: Record<string, unknown> | undefined,
	userId: string | undefined,
): void {
	if (userId !== game.user?.id || !(effect.parent instanceof Actor)) return;
	if (options?.[CONDITION_REPLACED_OPTION]) return;
	const given = (effect.system as { tempHp?: number | null } | undefined)?.tempHp;
	if (given) void takeBackTempHp(effect.parent as never, given);
}

function onDeleteEffect(
	effect: ActiveEffect,
	options?: Record<string, unknown>,
	userId?: string,
): void {
	takeBackEffectTempHp(effect, options, userId);
	if (!isActiveGm() || !(effect.parent instanceof Actor)) return;
	if (options?.[CONDITION_REPLACED_OPTION]) return;
	const holder = effect.parent;
	fireEvent('effectEnds', holder, { effectName: effect.name, effect: effect.name });
	if (effect.statuses?.has(STATUS_EFFECT_IDS.concentration)) {
		fireEvent('loseConcentration', holder);
	}
}

interface UseItemContext {
	targets?: Array<{ actor?: object | null } | null>;
}

function onUseItem(
	item: Parameters<typeof fireItemUseEvents>[0],
	_card: unknown,
	context?: UseItemContext,
) {
	const targets = (context?.targets ?? []).flatMap((target) =>
		target?.actor ? [target.actor] : [],
	);
	fireItemUseEvents(item, targets);
}

function onDamageApplied(payload: {
	targetActor?: Actor | null;
	sourceActor?: Actor | null;
	card?: { speaker?: ChatMessage['speaker'] } | null;
	isMiss?: boolean;
}): void {
	if (payload?.isMiss) return;
	fireEvent('takeDamage', payload?.targetActor ?? null);
	const dealer = payload?.card?.speaker
		? (ChatMessage.getSpeakerActor(payload.card.speaker) ?? payload.sourceActor)
		: payload?.sourceActor;
	fireEvent('nextDamage', (dealer as Actor | null | undefined) ?? null);
}

const ROLL_CARD_TYPES = new Set(['savingThrow', 'abilityCheck', 'skillCheck']);

/** A save or check card ends "until you make a roll" on the client that rolled it. */
function onCreateChatMessage(
	card: { type?: string; author?: { id?: string } | null; speaker?: ChatMessage['speaker'] },
	_options: unknown,
	userId: string,
): void {
	if (userId !== game.user?.id || !ROLL_CARD_TYPES.has(card.type ?? '')) return;
	if (!card.speaker) return;
	fireEvent('nextRoll', (ChatMessage.getSpeakerActor(card.speaker) as Actor | null) ?? null);
}

function onRest(payload: { actor?: Actor | null }): void {
	fireEvent('rest', payload?.actor ?? null);
}

function onChargeChanged(payload: {
	actor?: Actor | null;
	previousValue?: number;
	newValue?: number;
}): void {
	if (Number(payload?.newValue) > Number(payload?.previousValue)) {
		fireEvent('chargeGained', payload.actor ?? null);
	}
}

let registered = false;

/**
 * The moments of Lasts Until. Turn, round, combat and time moments, and the
 * events that every client sees, are checked on the active GM. The events of
 * one client (an item use, damage, a rest, a charge) are checked there.
 */
export default function registerLastsUntilHooks(): void {
	if (registered) return;
	registered = true;

	on('nimbleCombatTurnStart', onTurn('turnStart'));
	on('nimbleCombatTurnEnd', onTurn('turnEnd'));
	on('nimbleCombatRoundStart', onRound('roundStart'));
	on('nimbleCombatRoundEnd', onRound('roundEnd'));
	on('updateCombat', onUpdateCombat);
	on('deleteCombat', onDeleteCombat);
	on('updateWorldTime', onWorldTime);
	on('updateActor', onUpdateActor);
	on('updateToken', onUpdateToken);
	on('deleteActiveEffect', onDeleteEffect);
	on(systemHookName('useItem'), onUseItem);
	on(systemHookName('damageApplied'), onDamageApplied);
	on('createChatMessage', onCreateChatMessage);
	on(systemHookName('rest'), onRest);
	on(systemHookName('chargePool.changed'), onChargeChanged);
}
