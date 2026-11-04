import type { AnyRoll } from '#types/anyRoll.d.ts';
import type { ResultChange, ResultUse } from '#types/resultChange.d.ts';
import { rollInitiativeMana } from '#utils/combat/initiativeManaRoll.js';
import { getInitiativeStartingActions } from '#utils/combat/initiativeStartingActions.js';
import { checkCardRerollData } from '#utils/reroll/checkCardRollTarget.js';
import { keptD20 } from '#utils/reroll/checkRollOfCard.js';
import type { RerollingActor } from '#utils/reroll/rerollEntries.js';
import { resultTotal, standingResultChanges } from './resultChanges.js';

interface CardRoll {
	total?: number | null;
	terms: unknown[];
}

/** The advantage or disadvantage in a formula: "3d20khn" is 2, "2d20kl" is -1. */
function rollModeOfFormula(formula: string): number {
	const match = /^\s*(\d+)d20(?!\d)[a-z0-9]*?k([hl])/i.exec(formula);
	if (!match) return 0;
	const extraDice = Number(match[1]) - 1;
	return match[2].toLowerCase() === 'h' ? extraDice : -extraDice;
}

/** What a roll message needs to be an Initiative card. */
async function initiativeCardData(input: {
	actor: unknown;
	actorName: string;
	roll: AnyRoll;
	combatId: string | null;
	combatantId: string | null;
	/** The pending action adjustment the roll folded into the current actions. */
	foldedActionDelta: number;
}): Promise<{ type: 'initiative'; system: Record<string, unknown> }> {
	const actor = input.actor as
		| (RerollingActor & { type?: string; permission?: number; token?: { uuid?: string } | null })
		| null
		| undefined;
	const rollMode = rollModeOfFormula(input.roll.formula);
	const initiativeMana = await rollInitiativeMana(actor as never, input.combatId);
	const rerolls = actor
		? await checkCardRerollData(actor, input.roll, { kind: 'initiative', key: '' }, rollMode)
		: null;
	return {
		type: 'initiative',
		system: {
			actorName: input.actorName,
			actorType: actor?.type ?? '',
			permissions: actor?.permission ?? 0,
			rollMode,
			...rerolls?.system,
			combatId: input.combatId,
			combatantId: input.combatantId,
			foldedActionDelta: input.foldedActionDelta,
			...(initiativeMana
				? {
						initiativeMana,
						actorUuid: (actor as { uuid?: string } | null | undefined)?.uuid ?? null,
					}
				: {}),
		},
	};
}

/**
 * The starting actions an Initiative card says, from its roll and its changes. A
 * natural 20 still counts through an add. A set total replaces the roll.
 */
function startingActionsOfCard(roll: CardRoll, changes: readonly ResultChange[]): number {
	const setTotal = standingResultChanges(changes).some((change) => change.change === 'setTotal');
	return getInitiativeStartingActions(
		resultTotal(roll.total ?? 0, changes),
		setTotal ? null : keptD20(roll.terms),
	);
}

/** The starting actions after one more use on the card. */
function startingActionsAfterUse(
	roll: CardRoll,
	changes: readonly ResultChange[],
	use: ResultUse,
): number {
	return startingActionsOfCard(roll, [...changes, { ...use, retired: false } as ResultChange]);
}

export { initiativeCardData, startingActionsAfterUse, startingActionsOfCard };
