import type { PickableDie } from '../../src/dice/oneDieReroll.ts';
import type { DieOutcome } from '#utils/incomingReactionEntry.ts';

export interface RerollDiePickerProps {
	dice: PickableDie[];
	/** The feature the reroll uses, named while the die rolls. */
	feature: string;
	/** The card outcome, shown on the Primary Die. */
	primaryOutcome?: DieOutcome;
	/** The die that was picked and is now rolling. Null while the player picks. */
	rolling?: PickableDie | null;
	onpick: (die: PickableDie) => void;
	oncancel: () => void;
}
