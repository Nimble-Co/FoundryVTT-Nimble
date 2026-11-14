import { SYSTEM_ID } from '#system';
import { keyedQueue } from '#utils/keyedQueue.js';
import { turnsSeenAfter } from '#utils/lastsUntil/effectEndsAt.js';
import { effectsEndingAt, endEffects, everyActor } from '#utils/lastsUntil/endEffects.js';
import type { EndCheck, EndMoment } from '#utils/lastsUntil/endLines.js';
import type { LastsUntilCheck } from '#utils/lastsUntil/momentReached.js';
import { type WaitOptions, waitEndEffects } from '#utils/lastsUntil/waitEndEffects.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

const queue = keyedQueue();

/** End `effects` for one moment; with Feature Effects off, each waits for End (`waitEndEffects`). */
export async function endOrWaitEffects(
	effects: ActiveEffect[],
	moment: EndMoment,
	at?: EndCheck,
	wait: WaitOptions = {},
): Promise<void> {
	if (isRuleAutomationEnabled()) await endEffects(effects, moment, at);
	else await waitEndEffects(effects, moment, at, wait);
}

/**
 * End what `check` ends, on the card of that moment, and count its turn for the effects that stay.
 * What ends is read when the check happens, from the combat as it is then. The counts and ends go
 * one check at a time, so the next check counts from the counts of this one.
 */
export function endEffectsAt(
	check: LastsUntilCheck,
	moment: EndMoment,
	combat?: Combat | null,
): Promise<void> {
	const ending = effectsEndingAt(check, combat);
	return queue.run('at', async () => {
		await countMoments(check, combat, new Set(ending));
		await endOrWaitEffects(ending, moment, { check, combat }, { once: true });
	});
}

/**
 * A clock turn that a "2nd next turn" moment counts, or a combat end that a "2nd combat ends"
 * moment counts, goes on its count when it does not end the effect.
 */
async function countMoments(
	check: LastsUntilCheck,
	combat: Combat | null | undefined,
	ending: ReadonlySet<ActiveEffect>,
): Promise<void> {
	if (check.type !== 'turnStart' && check.type !== 'turnEnd' && check.type !== 'combatEnd') return;
	for (const actor of everyActor()) {
		for (const effect of actor.effects as Iterable<ActiveEffect>) {
			if (ending.has(effect)) continue;
			const seen = turnsSeenAfter(effect, check, combat);
			if (seen) await effect.update({ [`flags.${SYSTEM_ID}.turnsSeen`]: seen } as never);
		}
	}
}
