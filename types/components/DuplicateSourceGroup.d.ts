import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';

export interface DuplicateSourceGroupProps {
	/** Synthetic key the group is stored under; only used to scope element ids. */
	groupName: string;
	/** The duplicate cluster: its candidates, bounds, owned copies, and recommended pick. */
	group: SelectionGroup;
	/** Candidates currently chosen for granting. Never contains an owned copy. */
	selectedFeatures: NimbleFeatureItem[];
	/** Replaces the group's selection outright — this picker sets, it does not toggle. */
	onSetSelection: (features: NimbleFeatureItem[]) => void;
}
