import type { LinkedPart } from '#utils/documents/docLink.ts';
import type { CheckResult } from '#types/checkResult.d.ts';
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

/** One small line under a roll: where a part of it came from. */
export interface RollDetailLine {
	id: string;
	text: string;
	/** The same line with document names as links. */
	parts?: readonly LinkedPart[];
	tooltip?: string | null;
	/** The line tells of a bonus that is not added. */
	notAdded?: boolean;
}

export interface RollSummaryProps {
	label: string;
	subheading?: string | null;
	/** The result of a check, first on the small line under the name. */
	checkResult?: { result: CheckResult; label: string } | null;
	/** Words on the small line in the normal colour. */
	note?: string | null;
	tooltip?: string | null;
	total: number;
	options?: RollSummaryOptions;
	/** The small lines under the roll. */
	details?: readonly RollDetailLine[];
	/** The reroll dice of this roll are in the air: the total shows a tumbling die this size. */
	rolling?: { faces: number } | null;
	/** The total just replaced a rolling die, so it settles in. */
	landed?: boolean;
}
