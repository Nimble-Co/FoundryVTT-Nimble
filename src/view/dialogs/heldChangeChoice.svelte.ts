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
	const linesFor = (each: ActivatedItem) =>
		heldLinesForItem(actor, each, { ignoresDisadvantage, choosing });
	let lines = $state(linesFor(item));
	const rollModeTicks = $derived(
		lines.flatMap((line) => (line.rollMode ? [{ key: line.key, value: line.rollMode }] : [])),
	);
	let chosen = $state<string[]>([]);
	let ticks = $state<AppliedTicks>({});

	function choose(keys: string[]) {
		const moved = tickChosen(slider.get(), ticks, rollModeTicks, keys);
		slider.set(moved.mode);
		ticks = moved.applied;
		chosen = keys;
	}

	return {
		choosing,
		get lines() {
			return lines;
		},
		get chosen() {
			return chosen;
		},
		set chosen(keys: string[]) {
			choose(keys);
		},
		/** The lines of the item as it now attacks. A ticked change that leaves the lines is unticked. */
		reread(next: ActivatedItem) {
			const nextLines = linesFor(next);
			const staying = chosen.filter((key) => nextLines.some((line) => line.key === key));
			if (staying.length < chosen.length) choose(staying);
			lines = nextLines;
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
