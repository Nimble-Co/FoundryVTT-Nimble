import { coreEventOf } from '#utils/lastsUntil/coreEvents.js';
import { effectSubject } from '#utils/lastsUntil/effectSubject.js';
import {
	anyMomentReached,
	type LastsUntilCheck,
	type Moment,
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
	const subject = effectSubject(effect, check, combat ?? undefined);
	if (anyMomentReached(effect.lastsUntil ?? [], subject, check)) return true;
	if (check.type === 'combatEnd' && effect.isMinor && subject.relatesTo(check.combatId)) {
		return true;
	}
	return coreDurationEndsAt(effect, check, combat);
}
