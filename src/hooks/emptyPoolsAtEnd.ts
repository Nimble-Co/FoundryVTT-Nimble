import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { addMomentEvents } from '#utils/chat/cardEvents.js';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { END_LINES_OPTION, emptyPoolEvents } from '#utils/dicePool/emptyPoolLine.js';
import { type EndingEffect, poolsEmptiedAtEnd } from '#utils/dicePool/poolsEmptiedAtEnd.js';
import { eventHeading } from '#utils/lastsUntil/lastsUntilEvents.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

type NamedEffect = EndingEffect & { name?: string | null };

/**
 * Feature Effects off: the pools wait for a click. An end that posts its own lines (`endEffects`)
 * puts them there; any other end, such as a removal by hand, gets a card of its own.
 */
async function postWaitingPools(
	effect: NamedEffect,
	options: Record<string, unknown> | undefined,
): Promise<void> {
	if (options?.[END_LINES_OPTION]) return;
	const lines = emptyPoolEvents([effect], Date.now());
	if (lines.length < 1) return;
	const holder = effect.parent as { name?: string | null } | null;
	await addMomentEvents(
		{
			key: `once:${foundry.utils.randomID()}`,
			heading: eventHeading('effectEnds', { name: holder?.name, effect: effect.name }),
		},
		lines,
	);
}

/** An effect that ends by any path empties the pools of its Empty Pools at End rules. A replace is not an end. */
async function emptyPoolsOfEndedEffect(
	effect: NamedEffect,
	options: Record<string, unknown> | undefined,
): Promise<void> {
	if (options?.[CONDITION_REPLACED_OPTION]) return;
	if (!isRuleAutomationEnabled()) return postWaitingPools(effect, options);
	const emptied = poolsEmptiedAtEnd(effect);
	if (!emptied) return;
	for (const pool of emptied.pools) {
		await setPoolFaces(emptied.holder, pool.id, []);
	}
}

let registered = false;

/** The pools are emptied once, on the client of the user who deleted the effect. */
export default function registerEmptyPoolsAtEndHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('deleteActiveEffect', (effect, options, userId) => {
		if (userId !== game.user?.id) return;
		void emptyPoolsOfEndedEffect(
			effect as unknown as NamedEffect,
			options as unknown as Record<string, unknown>,
		).catch((error) =>
			console.error('Nimble | Could not empty the pools of an ended effect.', error),
		);
	});
}
