import type { CheckResult } from '../../src/utils/rolls/checkResult.ts';
import type { PrimaryDieBonusLine } from '../primaryDieBonus.d.ts';

export interface RollSummaryOptions {
	rollOptions?: {
		primaryDieValue?: string | number;
		primaryDieModifier?: string | number;
		primaryDieBaseResult?: number;
		/** The kept Primary Die face holds no primaryDieModifier. */
		primaryDieBonusOff?: boolean;
		[key: string]: unknown;
	};
	roll?: { terms?: { faces?: number }[] } | null;
	/** The card's Primary Die Bonus lines, to name who added the Primary Die bonus. */
	primaryDieBonuses?: readonly PrimaryDieBonusLine[];
	[key: string]: unknown;
}

export interface RollSummaryProps {
	label: string;
	subheading?: string | null;
	/** The result of a check, first on the small line under the name. */
	checkResult?: { result: CheckResult; label: string } | null;
	tooltip?: string | null;
	total: number;
	options?: RollSummaryOptions;
	showRollDetails?: boolean;
	/** The reroll dice of this roll are in the air: the total shows a tumbling die this size. */
	rolling?: { faces: number } | null;
	/** The total just replaced a rolling die, so it settles in. */
	landed?: boolean;
}
