import type { AppliedTicks } from '#types/conditionRollMode.d.ts';
import { heldLinesForItem } from '#utils/heldChange/heldChange.js';
import { tickChosen } from '#utils/rolls/rollModeTicks.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

type Holder = Parameters<typeof heldLinesForItem>[0];
type ActivatedItem = Parameters<typeof heldLinesForItem>[1];

/**
 * The Held Changes of a roll window. With Feature Effects off the player ticks each one, none
 * ticked at the start; a ticked change that gives advantage or disadvantage moves the slider.
 */
export function heldChangeChoice(
	actor: Holder,
	item: ActivatedItem,
	ignoresDisadvantage: boolean | undefined,
	slider: { get(): number; set(mode: number): void },
) {
	const choosing = !isRuleAutomationEnabled();
	const lines = heldLinesForItem(actor, item, { ignoresDisadvantage, choosing });
	const rollModeTicks = lines.flatMap((line) =>
		line.rollMode ? [{ key: line.key, value: line.rollMode }] : [],
	);
	let chosen = $state<string[]>([]);
	let ticks = $state<AppliedTicks>({});

	return {
		choosing,
		lines,
		get chosen() {
			return chosen;
		},
		set chosen(keys: string[]) {
			const moved = tickChosen(slider.get(), ticks, rollModeTicks, keys);
			slider.set(moved.mode);
			ticks = moved.applied;
			chosen = keys;
		},
		/** The roll mode steps that the ticked changes add to the roll. */
		get rollMode() {
			return Object.values(ticks).reduce((sum, step) => sum + step, 0);
		},
		/** The ticked changes for the roll, only when the player chooses them. */
		get rollOptions(): { heldChosen?: string[] } {
			return choosing ? { heldChosen: [...chosen] } : {};
		},
	};
}
