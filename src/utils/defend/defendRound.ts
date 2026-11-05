import { SYSTEM_ID } from '#system';

/** A point in a combat, so a 1/round use can tell when the hero's own turn came back. */
export interface RoundMark {
	combatId: string;
	round: number;
	turn: number;
}

/** A Defend that covers every attack on the hero until their own turn begins. */
export interface WholeRoundDefend extends RoundMark {
	label: string;
	armorBonus: number;
	outcome: string;
	messageId: string;
	recordId: string;
}

export const EXTRA_DEFEND_FLAG = 'extraDefendUsed';
export const WHOLE_ROUND_DEFEND_FLAG = 'wholeRoundDefend';

export function roundMarkNow(): RoundMark | null {
	const combat = game.combat;
	if (!combat?.started || !combat.id) return null;
	return { combatId: combat.id, round: combat.round ?? 0, turn: combat.turn ?? 0 };
}

/**
 * Whether the mark still holds: same combat, and the combatant's own turn has
 * not begun since (1/round abilities reset then, Core:567).
 */
export function roundMarkHolds(
	mark: Partial<RoundMark> | null | undefined,
	combatantId: string | null | undefined,
): boolean {
	const combat = game.combat;
	if (!mark || !combat?.started || mark.combatId !== combat.id) return false;
	const round = Number(mark.round);
	const turn = Number(mark.turn);
	if (!Number.isFinite(round) || !Number.isFinite(turn)) return false;
	const own = (combat.turns ?? []).findIndex((each) => each.id === combatantId);
	if (own < 0) return round === combat.round;
	const nextOwnRound = own > turn ? round : round + 1;
	const nowRound = combat.round ?? 0;
	const nowTurn = combat.turn ?? 0;
	return nowRound < nextOwnRound || (nowRound === nextOwnRound && nowTurn < own);
}

function flagOf<T>(actor: Actor.Implementation | null | undefined, key: string): T | null {
	return ((actor as { getFlag?: (scope: string, key: string) => unknown } | null)?.getFlag?.(
		SYSTEM_ID,
		key,
	) ?? null) as T | null;
}

export function extraDefendUsed(
	actor: Actor.Implementation | null | undefined,
	combatantId: string | null | undefined,
): boolean {
	return roundMarkHolds(flagOf<RoundMark>(actor, EXTRA_DEFEND_FLAG), combatantId);
}

export function wholeRoundDefendOf(
	actor: Actor.Implementation | null | undefined,
	combatantId: string | null | undefined,
): WholeRoundDefend | null {
	const flag = flagOf<WholeRoundDefend>(actor, WHOLE_ROUND_DEFEND_FLAG);
	return flag && roundMarkHolds(flag, combatantId) ? flag : null;
}
