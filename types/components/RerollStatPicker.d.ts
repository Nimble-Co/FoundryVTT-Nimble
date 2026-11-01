import type { StatChoice } from '#utils/reroll/rollStat.ts';

export interface RerollStatPickerProps {
	stats: StatChoice[];
	feature: string;
	/** The request for the picked stat is out. */
	sending?: boolean;
	onpick: (stat: string) => void;
}
