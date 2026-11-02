import type { PickableDie } from '../../src/dice/oneDieReroll.ts';
import type { DieOutcome, RollUse } from '#utils/incomingReactions/incomingReactionEntry.ts';

export interface RerollDiePickerProps {
	dice: PickableDie[];
	/** The feature the reroll uses, named while the die rolls. */
	feature: string;
	/** The card outcome, shown on the Primary Die. */
	primaryOutcome?: DieOutcome;
	/** A change picks the die to change; the words say so. */
	use?: RollUse;
	/** The die that was picked and is now rolling. Null while the player picks. */
	rolling?: PickableDie | null;
	/** The player picks several dice and confirms. */
	several?: { max: number; manaPerDie: number } | null;
	onconfirm?: (dice: PickableDie[]) => void;
	onpick: (die: PickableDie) => void;
	oncancel: () => void;
}
