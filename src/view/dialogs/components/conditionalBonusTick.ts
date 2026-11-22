import { labelNote } from '#utils/chargePool/poolHeading.js';
import localize from '#utils/localize.js';

const TEXT = 'NIMBLE.activationDialog.conditionalBonus';

/** "Lunging Strike: +1d6 × 2 damage (+1 Reach)": a note in brackets on the label goes last. */
export function conditionalBonusTick(label: string, damage: string): string {
	const { name, note } = labelNote(label);
	return note
		? localize(`${TEXT}.tickWithNote`, { label: name, value: damage, note })
		: localize(`${TEXT}.tick`, { label, value: damage });
}
