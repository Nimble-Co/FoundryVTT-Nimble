import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { type EndingEffect, poolsEmptiedAtEnd } from '#utils/dicePool/poolsEmptiedAtEnd.js';

/** An effect that ends by any path empties the pools of its Empty Pools at End rules. A replace is not an end. */
async function emptyPoolsOfEndedEffect(
	effect: EndingEffect,
	options: Record<string, unknown> | undefined,
): Promise<void> {
	if (options?.[CONDITION_REPLACED_OPTION]) return;
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
			effect as unknown as EndingEffect,
			options as unknown as Record<string, unknown>,
		).catch((error) =>
			console.error('Nimble | Could not empty the pools of an ended effect.', error),
		);
	});
}
