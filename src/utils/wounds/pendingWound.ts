import { getActorWoundsValueAndMax } from '#utils/actor/actorResources.js';
import { actorRules, ruleLabel } from '#utils/actor/actorRules.js';
import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import { raisePoolDiceOnWounds } from '../../hooks/dicePoolTriggers/poolDieToMaxTrigger.js';
import { askOwner } from './askOwner.js';
import { rulesWatching, type WoundCreature } from './rulesWatching.js';

export type WoundCause = 'direct' | 'dropToZero' | 'dyingDamage' | 'redirect';

export interface WoundSource {
	uuid?: string | null;
	name?: string | null;
	actor?: WoundCreature | null;
}

/** What a pending-Wound rule sees. `headroom` is max Wounds minus the current count. */
export interface PendingWoundView {
	amount: number;
	requested: number;
	negated: number;
	cause: WoundCause;
	critical: boolean;
	wounds: { value: number; max: number };
	headroom: number;
	reachesLastWound: boolean;
	source: WoundSource | null;
}

export interface PendingWoundPlan {
	change: 'negate' | 'lower' | 'set' | 'redirect';
	/** How many Wounds the change covers. Infinity covers every pending Wound. */
	take: number;
	redirectTo: 'source' | 'watcher';
	moveDistance: number;
}

export interface PendingWoundOffer {
	name: string;
	amount: number;
	change: string;
}

export interface PendingWoundRequest {
	actor: WoundCreature;
	amount: number;
	cause?: WoundCause;
	critical?: boolean;
	source?: WoundSource | null;
	seen?: ReadonlySet<string>;
	choose?: (offer: PendingWoundOffer) => Promise<boolean>;
	watchers?: readonly WoundCreature[];
}

export interface PendingRedirect {
	actor: WoundCreature;
	amount: number;
}

export interface PendingMove {
	actorUuid: string;
	distance: number;
	name: string;
}

export interface PendingWoundOutcome {
	land: number;
	negated: number;
	redirects: PendingRedirect[];
	moves: PendingMove[];
	seen: Set<string>;
}

interface PendingRule {
	type?: string;
	priority?: number;
	choice?: string;
	watch?: string;
	reach?: number;
	label?: string;
	parentDocument?: { name?: string | null } | null;
	actor?: WoundCreature;
	matchesPending?: (view: PendingWoundView) => boolean;
	planPending?: (view: PendingWoundView, mover: WoundCreature) => PendingWoundPlan;
	commitPending?: () => Promise<void> | void;
}

function covered(take: number, pending: number): number {
	if (take === Number.POSITIVE_INFINITY) return pending;
	if (!Number.isFinite(take) || take <= 0) return 0;
	return Math.min(pending, Math.floor(take));
}

function setTo(take: number): number {
	if (!Number.isFinite(take)) return 0;
	return Math.max(0, Math.floor(take));
}

function woundTrack(actor: WoundCreature): { value: number; max: number } {
	return getActorWoundsValueAndMax(actor as never) ?? { value: 0, max: 0 };
}

/** A negated Wound never raises the track, so the update watchers do not see it. */
async function observeWounds(actor: WoundCreature, count: number): Promise<void> {
	if (!(count >= 1)) return;
	for (let i = 0; i < count; i += 1) {
		await applyRecoveryToActorIfEligible(actor as never, 'onWound');
	}
	await raisePoolDiceOnWounds(actor as never, count);
}

function immune(actor: WoundCreature): boolean {
	return actorRules<{ type?: string; appliesTo?: () => boolean }>(actor).some(
		(rule) => rule?.type === 'woundImmunity' && (!rule.appliesTo || rule.appliesTo()),
	);
}

function redirectTarget(
	plan: PendingWoundPlan,
	holder: WoundCreature,
	source: WoundSource | null,
): WoundCreature | null {
	if (plan.redirectTo === 'watcher') return holder;
	if (source?.actor) return source.actor;
	if (!source?.uuid) return null;
	try {
		return fromUuidSync(source.uuid) as WoundCreature | null;
	} catch {
		return null;
	}
}

function canReceive(actor: WoundCreature | null): actor is WoundCreature & { uuid: string } {
	if (!actor?.uuid) return false;
	return typeof (actor as { update?: unknown }).update === 'function';
}

async function offerMove(actor: WoundCreature, distance: number, name: string): Promise<void> {
	if (!(distance >= 1)) return;
	try {
		const { offerWoundMove } = await import('./offerWoundMove.js');
		await offerWoundMove(actor, distance, name);
	} catch {
		// The move is recorded either way. A missing token must not undo the Wound.
	}
}

async function askPending(
	actor: WoundCreature,
	offer: PendingWoundOffer,
	choose: PendingWoundRequest['choose'],
): Promise<boolean> {
	if (choose) return choose(offer);
	return askOwner(actor, { kind: 'pending', name: offer.name, count: offer.amount });
}

/**
 * Decides how many of `amount` Wounds land on the creature. Negated Wounds do
 * not land and still count for features that watch Wounds. Lower and set do
 * not. Redirected Wounds are returned for the caller to give to someone else;
 * this function does not write a Wound.
 */
export async function alterPendingWound(
	request: PendingWoundRequest,
): Promise<PendingWoundOutcome> {
	const actor = request.actor;
	const seen = new Set(request.seen ?? []);
	if (actor.uuid) seen.add(actor.uuid);

	const requested = Math.max(0, Math.floor(request.amount));
	let amount = requested;
	let negated = 0;
	const redirects: PendingRedirect[] = [];
	const moves: PendingMove[] = [];
	const cause = request.cause ?? 'direct';
	const critical = request.critical === true;
	const source = request.source ?? null;
	const track = woundTrack(actor);

	const view = (): PendingWoundView => ({
		amount,
		requested,
		negated,
		cause,
		critical,
		wounds: { value: track.value, max: track.max },
		headroom: Math.max(0, track.max - track.value),
		reachesLastWound: track.max > 0 && track.value < track.max && track.value + amount >= track.max,
		source,
	});

	if (amount > 0 && immune(actor)) {
		negated += amount;
		amount = 0;
	}

	const watching = rulesWatching<PendingRule>(actor, 'pendingWound', request.watchers);
	const automatics = watching.filter(({ rule }) => rule.choice !== 'offer');
	const offers = watching.filter(({ rule }) => rule.choice === 'offer');

	const apply = async (rule: PendingRule, holder: WoundCreature, plan: PendingWoundPlan) => {
		const before = amount;
		const beforeRedirects = redirects.length;
		if (plan.change === 'negate') {
			const take = covered(plan.take, amount);
			negated += take;
			amount -= take;
		} else if (plan.change === 'lower') {
			amount -= covered(plan.take, amount);
		} else if (plan.change === 'set') {
			amount = setTo(plan.take);
		} else if (plan.change === 'redirect') {
			const take = covered(plan.take, amount);
			const target = redirectTarget(plan, holder, source);
			if (take > 0 && canReceive(target) && !seen.has(target.uuid)) {
				seen.add(target.uuid);
				amount -= take;
				redirects.push({ actor: target, amount: take });
			}
		}
		if (amount === before && redirects.length === beforeRedirects) return;
		await rule.commitPending?.();
		if (!(plan.moveDistance >= 1)) return;
		const name = ruleLabel(rule);
		moves.push({ actorUuid: actor.uuid ?? '', distance: plan.moveDistance, name });
		await offerMove(actor, plan.moveDistance, name);
	};

	for (const { rule, holder } of automatics) {
		if (amount <= 0) break;
		const current = view();
		if (!rule.matchesPending?.(current)) continue;
		const plan = rule.planPending?.(current, actor);
		if (!plan) continue;
		await apply(rule, holder, plan);
	}

	for (const { rule, holder } of offers) {
		if (amount <= 0) break;
		const current = view();
		if (!rule.matchesPending?.(current)) continue;
		const plan = rule.planPending?.(current, actor);
		if (!plan) continue;
		const touching = plan.change === 'set' ? setTo(plan.take) : covered(plan.take, amount);
		const accepted = await askPending(
			holder,
			{ name: ruleLabel(rule), amount: touching, change: plan.change },
			request.choose,
		);
		if (!accepted) continue;
		await apply(rule, holder, plan);
	}

	if (negated > 0) await observeWounds(actor, negated);

	return { land: amount, negated, redirects, moves, seen };
}
