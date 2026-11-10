import {
	type EffectStart,
	type LastsUntilCheck,
	type MomentSubject,
	sameSeat,
	type TurnSeat,
} from '#utils/lastsUntil/momentReached.js';
import { secondsOf } from '#utils/lastsUntil/secondsOf.js';
import { getMinionGroupId } from '#utils/minions/minionGrouping.js';

type CombatantLike = Combatant.Implementation;

export function seatOf(combatant: CombatantLike): TurnSeat {
	return {
		combatantId: combatant.id ?? '',
		groupId: getMinionGroupId(combatant),
		isHero: combatant.type === 'character',
	};
}

/** The holder of an effect on an actor; null for an effect on an item. */
export function holderOf(effect: ActiveEffect): Actor | null {
	return effect.parent instanceof Actor ? effect.parent : null;
}

/** The creature that applied the effect: the owner of the origin item, or the origin actor. */
export function sourceOf(effect: ActiveEffect): Actor | null {
	if (!effect.origin) return null;
	const origin = fromUuidSync(effect.origin as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	});
	if (origin instanceof Actor) return origin;
	if (origin instanceof Item) return (origin.actor as Actor | null) ?? null;
	return null;
}

function sameActor(a: Actor | null | undefined, b: Actor | null | undefined): boolean {
	if (!a || !b) return false;
	return a === b || (!!a.uuid && a.uuid === b.uuid);
}

function seatsOf(actor: Actor | null, combat: Combat | null | undefined): TurnSeat[] {
	if (!actor || !combat) return [];
	return combat.combatants.contents
		.filter((combatant) => sameActor(combatant.actor as Actor | null, actor))
		.map(seatOf);
}

/** A prepared `start.combat` is the Combat document; its source is the id. */
function idOf(value: string | { id?: string | null } | null | undefined): string | null {
	if (!value) return null;
	return typeof value === 'string' ? value : (value.id ?? null);
}

function combatOfCheck(check: LastsUntilCheck): Combat | null {
	if (!('combatId' in check)) return game.combat ?? null;
	return (game.combats?.get(check.combatId) as Combat | undefined) ?? game.combat ?? null;
}

/**
 * What the moments of `effect` read, for one check. `combat` is the combat of
 * the check, which can be already deleted at combat end.
 */
export function effectSubject(
	effect: ActiveEffect,
	check: LastsUntilCheck,
	combat: Combat | null = combatOfCheck(check),
): MomentSubject {
	const holder = holderOf(effect);
	const source = sourceOf(effect);
	const start = (effect.start ?? { time: 0 }) as Partial<Omit<EffectStart, 'combat'>> & {
		combat?: string | { id?: string | null } | null;
	};
	const fullStart: EffectStart = {
		combat: idOf(start.combat),
		combatant: start.combatant ?? null,
		round: start.round ?? null,
		turn: start.turn ?? null,
		time: start.time ?? 0,
	};
	const startCombatant =
		combat && fullStart.combat === combat.id && fullStart.combatant
			? (combat.combatants.get(fullStart.combatant) as CombatantLike | undefined)
			: undefined;
	const holderSeats = seatsOf(holder, combat);
	const sourceSeats = seatsOf(source, combat);

	return {
		start: fullStart,
		startSeat: startCombatant ? seatOf(startCombatant) : null,
		holder,
		source,
		origin: effect.origin ?? null,
		holderInCombat: !!(holder as { inCombat?: boolean } | null)?.inCombat,
		isClockTurn(clock, seat) {
			if (clock === 'nextHero') return seat.isHero;
			const seats = clock === 'holder' ? holderSeats : sourceSeats;
			return seats.some((each) => sameSeat(each, seat));
		},
		relatesTo(combatId) {
			if (fullStart.combat === combatId) return true;
			return combat?.id === combatId && (holderSeats.length > 0 || sourceSeats.length > 0);
		},
		secondsOf,
	};
}
