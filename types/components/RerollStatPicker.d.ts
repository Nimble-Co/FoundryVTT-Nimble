import type { StatChoice } from '#types/rollStat.d.ts';

export interface RerollStatPickerProps {
	stats: StatChoice[];
	feature: string;
	/** The uuid of the feature's item: its name opens the item. */
	featureUuid?: string | null;
	/** The request for the picked stat is out. */
	sending?: boolean;
	onpick: (stat: string) => void;
	oncancel: () => void;
}
