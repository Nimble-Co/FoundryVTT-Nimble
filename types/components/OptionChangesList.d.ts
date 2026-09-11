import type { OptionChange } from '#managers/RestManager.ts';

export interface OptionChangesListProps {
	/** One row per pool or skill the rest changed. An empty list renders nothing. */
	changes: OptionChange[];
}
