import { SYSTEM_ID } from '#system';
import { seatOf } from '#utils/lastsUntil/effectSubject.js';
import { type Moment, sameSeat, type TurnSeat } from '#utils/lastsUntil/momentReached.js';

/** The round of the holder's last attack or use of the origin item, in one combat. */
export const LAST_ACTIVITY_FLAG = 'lastActivity';

interface Activity {
	combatId: string;
	round: number;
}

interface ActivityEffect {
	id?: string | null;
	active?: boolean;
	origin?: string | null;
	isOwner?: boolean;
	start?: { combat?: string | { id?: string | null } | null; round?: number | null } | null;
	lastsUntil?: Moment[];
	system?: unknown;
	getFlag?(scope: string, key: string): unknown;
	update?(data: Record<string, unknown>): Promise<unknown>;
}

interface Holder {
	uuid?: string | null;
	effects?: Iterable<unknown> | null;
}

interface CombatLike {
	id?: string | null;
	round?: number | null;
	started?: boolean;
	combatants?: { contents?: Array<{ actor?: unknown }> } | Iterable<{ actor?: unknown }>;
}

function momentsOf(effect: ActivityEffect): Moment[] {
	return (
		effect.lastsUntil ?? (effect.system as { lastsUntil?: Moment[] } | undefined)?.lastsUntil ?? []
	);
}

/** The effect ends after a round with no activity of its holder. */
export function hasInactiveRound(effect: ActivityEffect): boolean {
	return momentsOf(effect).some(
		(moment) =>
			moment.kind === 'event' && moment.event === 'inactiveRound' && moment.who !== 'source',
	);
}

function combatantsOf(combat: CombatLike): Array<{ actor?: unknown }> {
	const { combatants } = combat;
	if (!combatants) return [];
	if ('contents' in combatants && Array.isArray(combatants.contents)) return combatants.contents;
	return [...(combatants as Iterable<{ actor?: unknown }>)];
}

function fightsIn(actor: Holder, combat: CombatLike): boolean {
	return combatantsOf(combat).some((combatant) => {
		const other = combatant.actor as Holder | null | undefined;
		return !!other && (other === actor || (!!actor.uuid && other.uuid === actor.uuid));
	});
}

/** The started combat that the holder fights in: the viewed one first. */
function combatOf(actor: Holder): CombatLike | null {
	const combats = [game.combat, ...((game.combats ?? []) as Iterable<unknown>)] as Array<
		CombatLike | null | undefined
	>;
	return (
		combats.find((combat) => !!combat?.started && !!combat.id && fightsIn(actor, combat)) ?? null
	);
}

function activityOf(effect: ActivityEffect): Activity | null {
	const value = effect.getFlag?.(SYSTEM_ID, LAST_ACTIVITY_FLAG) as Partial<Activity> | undefined;
	if (typeof value?.combatId !== 'string' || typeof value.round !== 'number') return null;
	return { combatId: value.combatId, round: value.round };
}

/**
 * Note activity of the holder on each of its effects that end after an inactive round: an attack
 * counts for every such effect, a use of an item only for the effects that item made. Out of
 * combat nothing is noted. Run on the client where the activity happens.
 */
export function noteActivity(
	holder: object | null | undefined,
	activity: { attack: boolean; itemUuid?: string | null },
): void {
	const actor = holder as Holder | null | undefined;
	if (!actor) return;
	const combat = combatOf(actor);
	if (!combat?.id) return;
	const stamp: Activity = { combatId: combat.id, round: Number(combat.round) || 0 };
	for (const entry of actor.effects ?? []) {
		const effect = entry as ActivityEffect;
		if (!effect.update || effect.isOwner === false || !hasInactiveRound(effect)) continue;
		const counts = activity.attack || (!!activity.itemUuid && effect.origin === activity.itemUuid);
		if (!counts) continue;
		const last = activityOf(effect);
		if (last?.combatId === stamp.combatId && last.round === stamp.round) continue;
		// The effect can end at the same moment; a write that misses it changes nothing.
		effect.update({ [`flags.${SYSTEM_ID}.${LAST_ACTIVITY_FLAG}`]: stamp }).catch(() => {});
	}
}

function startCombatId(effect: ActivityEffect): string | null {
	const combat = effect.start?.combat;
	if (!combat) return null;
	return typeof combat === 'string' ? combat : (combat.id ?? null);
}

/** No activity of the holder in this round of the combat, and the effect did not start in it. */
export function inactiveThisRound(
	effect: ActivityEffect,
	combatId: string,
	round: number,
): boolean {
	if (effect.active === false || !hasInactiveRound(effect)) return false;
	if (startCombatId(effect) === combatId && effect.start?.round === round) return false;
	const last = activityOf(effect);
	return !(last?.combatId === combatId && last.round === round);
}

/** The effects of the creatures at `seat` that end as their turn in `round` ends. */
export function effectsInactiveAt(combat: Combat, seat: TurnSeat, round: number): ActiveEffect[] {
	if (!combat.id) return [];
	const holders = new Set<Actor>();
	for (const combatant of combat.combatants.contents) {
		if (!sameSeat(seatOf(combatant), seat)) continue;
		if (combatant.actor) holders.add(combatant.actor as Actor);
	}
	const found: ActiveEffect[] = [];
	for (const holder of holders) {
		for (const effect of (holder.effects ?? []) as Iterable<ActiveEffect>) {
			if (inactiveThisRound(effect as unknown as ActivityEffect, combat.id, round)) {
				found.push(effect);
			}
		}
	}
	return found;
}
