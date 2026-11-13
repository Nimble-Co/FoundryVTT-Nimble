import { SYSTEM_ID } from '#system';
import type { RoundMark, WholeRoundDefend } from '#types/defend.d.ts';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';

export const EXTRA_DEFEND_FLAG = 'extraDefendUsed';
/** The flag of the Timed Effect that holds a Defend for the whole round. */
export const ROUND_DEFEND_FLAG = 'roundDefend';

const ROUND_DEFEND_IMG = 'icons/svg/shield.svg';

/** Until the start of the holder's next turn. */
const UNTIL_HOLDER_TURN_STARTS: Moment = {
	kind: 'turn',
	boundary: 'start',
	clock: 'holder',
	span: 'nextTurn',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
};

interface MarkEffect {
	id?: string | null;
	disabled?: boolean;
	flags?: Record<string, Record<string, unknown> | undefined> | null;
}

interface MarkHolder {
	effects?: Iterable<MarkEffect> | null;
}

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

function wholeRoundOfEffect(effect: MarkEffect): WholeRoundDefend | null {
	const whole = effect.flags?.[SYSTEM_ID]?.[ROUND_DEFEND_FLAG] as WholeRoundDefend | undefined;
	return whole && typeof whole === 'object' ? whole : null;
}

/** The ids of the actor's whole-round Defend effects; with a record id, only that Defend's. */
export function roundDefendEffectIds(
	actor: MarkHolder | null | undefined,
	recordId?: string,
): string[] {
	return [...(actor?.effects ?? [])].flatMap((effect) => {
		const whole = wholeRoundOfEffect(effect);
		if (!whole || !effect.id) return [];
		return recordId === undefined || whole.recordId === recordId ? [effect.id] : [];
	});
}

export function wholeRoundDefendOf(
	actor: Actor.Implementation | null | undefined,
	combatantId: string | null | undefined,
): WholeRoundDefend | null {
	for (const effect of ((actor as MarkHolder | null)?.effects ?? []) as Iterable<MarkEffect>) {
		if (effect.disabled) continue;
		const whole = wholeRoundOfEffect(effect);
		if (whole && roundMarkHolds(whole, combatantId)) return whole;
	}
	return null;
}

/** The Timed Effect that holds a Defend for the whole round, on its hero. */
export function roundDefendEffectData(
	whole: WholeRoundDefend,
	source: { name: string; img?: string | null; origin: string | null },
): Record<string, unknown> {
	return {
		name: source.name,
		img: source.img || ROUND_DEFEND_IMG,
		type: NIMBLE_EFFECT_TYPE,
		origin: source.origin,
		system: { lastsUntil: [UNTIL_HOLDER_TURN_STARTS] },
		flags: { [SYSTEM_ID]: { [ROUND_DEFEND_FLAG]: whole } },
	};
}
