import type { AppliedTicks } from '../../src/utils/rolls/rollModeTicks.ts';

export interface SituationalRollModeListOption {
	key: string;
	label: string;
	/** Image beside the label; none when empty. */
	icon: string;
	/** Positive for advantage, negative for disadvantage. */
	value: number;
	/** Ticked when the window opens. */
	on?: boolean;
}

export interface SituationalRollModeListProps {
	options: SituationalRollModeListOption[];
	/** The Roll Mode slider value the ticks move. */
	value: number;
	applied: AppliedTicks;
}
