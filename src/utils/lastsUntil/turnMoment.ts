import type { CardEventMoment, TurnMomentType, TurnPlace } from '#types/cardEvent.d.ts';

interface TurnCombatant {
	id?: string | null;
	name?: string | null;
	combat?: {
		id?: string | null;
		round?: number | null;
		turn?: number | null;
		turns?: readonly { id?: string | null }[];
	} | null;
}

/** The round of the turn that just ended, when the combat class did not say. */
function roundOfEndedTurn(combatant: TurnCombatant): number {
	const combat = combatant.combat;
	const round = Number(combat?.round) || 0;
	const index = (combat?.turns ?? []).findIndex((each) => each.id === combatant.id);
	return index > Number(combat?.turn ?? 0) ? Math.max(0, round - 1) : round;
}

/**
 * Which turn of the round: the combatant. A combatant with more than one turn in a round (a solo
 * monster) adds the index in the turn order, when the place says it.
 */
function turnSeat(combatant: TurnCombatant, place?: TurnPlace): string {
	const id = combatant.id ?? '';
	const turns = (combatant.combat?.turns ?? []).filter((each) => each.id === combatant.id);
	if (turns.length > 1 && typeof place?.turn === 'number') return `${id}@${place.turn}`;
	return id;
}

/**
 * The moment card of the start or end of a turn: the key that finds it, and its heading. Every
 * poster of one turn boundary uses it, so their lines go on one card. Null outside a combat.
 */
export function turnMoment(
	type: TurnMomentType,
	combatant: TurnCombatant | null | undefined,
	place?: TurnPlace,
): { moment: CardEventMoment; round: number } | null {
	const combatId = combatant?.combat?.id;
	if (!combatant || !combatId) return null;
	const round =
		place?.round ??
		(type === 'turnEnd' ? roundOfEndedTurn(combatant) : Number(combatant.combat?.round) || 0);
	return {
		round,
		moment: {
			key: `${combatId}:${round}:${turnSeat(combatant, place)}:${type}`,
			heading: {
				key: `NIMBLE.lastsUntil.chat.heading.${type}`,
				data: { name: combatant.name ?? '' },
			},
		},
	};
}
