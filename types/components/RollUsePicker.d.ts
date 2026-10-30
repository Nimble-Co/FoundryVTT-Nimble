import type { PickableDie } from '../../src/dice/oneDieReroll.ts';
import type { DieOutcome } from '#utils/incomingReactions/incomingReactionEntry.ts';
import type { PrimaryDieBonusLine } from '../primaryDieBonus.d.ts';
import type { IncomingReactionPicking } from './IncomingReactionPrompts.d.ts';

export interface RollUsePickerProps {
	picking: IncomingReactionPicking;
	feature: string;
	primaryOutcome?: DieOutcome;
	primaryDieBonuses?: readonly PrimaryDieBonusLine[];
	onpick: (die: PickableDie) => void;
	onvalue: (value: number) => void;
	oncancel: () => void;
}
