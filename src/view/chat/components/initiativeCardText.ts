import type { ResultUse } from '#types/resultChange.d.ts';

import localize from '#utils/localize.js';
import { startingActionsAfterUse, startingActionsOfCard } from '#utils/rolls/initiativeCard.ts';
import { resultChangesOf } from '#utils/rolls/resultChanges.ts';

interface InitiativeCardView {
	type: string;
	system: unknown;
	rolls: unknown[];
}

type FirstRoll = Parameters<typeof startingActionsOfCard>[0];

function startWith(actions: number): string {
	return actions === 1
		? localize('NIMBLE.chat.initiative.startWithOneAction')
		: localize('NIMBLE.chat.initiative.startWithActions', { count: String(actions) });
}

/** The first roll, when this card's number is the book's: a hero's Initiative. */
function heroRoll(card: InitiativeCardView): FirstRoll | null {
	if (card.type !== 'initiative') return null;
	if ((card.system as { actorType?: string } | null)?.actorType !== 'character') return null;
	return (card.rolls[0] as FirstRoll | undefined) ?? null;
}

/** The small line of an Initiative card. Null when the card's number is not the book's. */
function startingActionsLine(card: InitiativeCardView): string | null {
	const roll = heroRoll(card);
	return roll ? startWith(startingActionsOfCard(roll, resultChangesOf(card.system))) : null;
}

/** What a row of an Initiative card gains, for its cost column. Empty on any other card. */
function initiativeRowGain(card: InitiativeCardView, use: ResultUse): string {
	const roll = heroRoll(card);
	return roll ? startWith(startingActionsAfterUse(roll, resultChangesOf(card.system), use)) : '';
}

export { initiativeRowGain, startingActionsLine };
