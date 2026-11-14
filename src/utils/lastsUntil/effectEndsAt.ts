import { coreEventOf } from '#utils/lastsUntil/coreEvents.js';
import { effectSubject } from '#utils/lastsUntil/effectSubject.js';
import {
	anyMomentReached,
	combatEndRelates,
	countedAt,
	type LastsUntilCheck,
	type Moment,
	momentCount,
	momentReached,
} from '#utils/lastsUntil/momentReached.js';

/** The parts of a Nimble Active Effect the end check reads. */
interface TimedEffect extends ActiveEffect {
	lastsUntil?: Moment[];
	isMinor?: boolean;
}

type CoreExpiryCheck = (this: ActiveEffect, event: string, context: object) => boolean;

/** Core's duration rule: the duration is reached, and the event is the expiry event. */
function coreDurationEndsAt(
	effect: ActiveEffect,
	check: LastsUntilCheck,
	combat: Combat | null | undefined,
): boolean {
	if (!effect.isTemporary) return false;
	if (check.type === 'event' && check.actor !== effect.parent) return false;
	// As core's registry: a turn or round end never changes what is left.
	const ends = check.type === 'turnEnd' || check.type === 'roundEnd';
	const duration = (ends ? effect.duration : effect.updateDuration()) as { remaining?: number };
	const { remaining } = duration;
	const left = remaining ?? Number.POSITIVE_INFINITY;
	if (left > 0 && Number.isFinite(left)) return false;
	const isExpiryEvent = ActiveEffect.prototype.isExpiryEvent as unknown as CoreExpiryCheck;
	return isExpiryEvent.call(effect, coreEventOf(check), { combat: combat ?? undefined });
}

/**
 * Whether `effect` ends at `check`: one of its Lasts Until moments (the first
 * moment wins), a Minor Status at combat end, or a core duration by core's rule.
 * Only an active effect on an actor ends; an item keeps the effects it holds.
 */
export function effectEndsAt(
	effect: TimedEffect,
	check: LastsUntilCheck,
	combat?: Combat | null,
): boolean {
	if (!(effect.parent instanceof Actor) || !effect.active) return false;
	if (check.type === 'event' && check.gained === effect) return false;
	const subject = effectSubject(effect, check, combat ?? undefined);
	if (anyMomentReached(effect.lastsUntil ?? [], subject, check)) return true;
	if (check.type === 'combatEnd' && effect.isMinor && combatEndRelates(subject, check)) {
		return true;
	}
	return coreDurationEndsAt(effect, check, combat);
}

/**
 * Which end of `effect` `check` reaches: a Lasts Until moment (by its index), a Minor Status at the
 * end of one combat, or the core duration.
 */
export function reachedEndKey(
	effect: TimedEffect,
	check: LastsUntilCheck,
	combat?: Combat | null,
): string {
	if (!(effect.parent instanceof Actor)) return 'duration';
	const subject = effectSubject(effect, check, combat ?? undefined);
	const index = (effect.lastsUntil ?? []).findIndex((moment, at) =>
		momentReached(moment, subject, check, at),
	);
	if (index >= 0) return `lastsUntil${index}`;
	if (check.type === 'combatEnd' && effect.isMinor) return `minor-${check.combatId}`;
	return 'duration';
}

/** The Lasts Until moment of `effect` that `check` reaches, as plain data. Null when none does. */
export function endingMoment(
	effect: TimedEffect,
	check: LastsUntilCheck,
	combat?: Combat | null,
): Moment | null {
	const moments = effect.lastsUntil ?? [];
	if (moments.length < 1 || !(effect.parent instanceof Actor)) return null;
	const subject = effectSubject(effect, check, combat ?? undefined);
	const found = moments.find((moment, index) => momentReached(moment, subject, check, index));
	if (!found) return null;
	return {
		kind: found.kind,
		boundary: found.boundary ?? null,
		clock: found.clock ?? null,
		span: found.span ?? null,
		value: found.value ?? null,
		units: found.units ?? null,
		who: found.who ?? null,
		event: found.event ?? null,
		effectName: found.effectName ?? '',
		damageTypes: [...(found.damageTypes ?? [])],
	};
}

/**
 * The clock turns or combat ends each moment of `effect` has counted once `check` counts too. Null
 * when `check` counts no "2nd next turn" or "2nd combat ends" moment of it.
 */
export function turnsSeenAfter(
	effect: TimedEffect,
	check: LastsUntilCheck,
	combat?: Combat | null,
): number[] | null {
	const moments = effect.lastsUntil ?? [];
	if (!moments.some((moment) => momentCount(moment) > 1)) return null;
	if (!(effect.parent instanceof Actor) || !effect.active) return null;
	const subject = effectSubject(effect, check, combat ?? undefined);
	let counted = false;
	const seen = moments.map((moment, index) => {
		const before = subject.turnsSeen?.[index] ?? 0;
		if (!countedAt(moment, subject, check, index)) return before;
		counted = true;
		return before + 1;
	});
	return counted ? seen : null;
}
