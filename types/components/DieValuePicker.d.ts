import type { PickableDie } from '../../src/dice/oneDieReroll.ts';
import type { DieOutcome } from '#utils/incomingReactions/incomingReactionEntry.ts';
import type { PrimaryDieBonusLine } from '../../src/view/chat/components/primaryDieBonusText.ts';

export interface DieValuePickerProps {
	/** The die that gets the new value. */
	die: PickableDie;
	/** The feature that changes the die, named while the request is out. */
	feature: string;
	/** The card outcome, shown on the old die when it is the Primary Die. */
	primaryOutcome?: DieOutcome;
	/** The card's Primary Die Bonus lines, to name who added the die's bonus. */
	bonusLines?: readonly PrimaryDieBonusLine[];
	/** The request is out: the picker says so and takes no input. */
	sending?: boolean;
	onpick: (value: number) => void;
	oncancel: () => void;
}
