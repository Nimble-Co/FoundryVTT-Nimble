import type { NimbleFeatureItem } from '#documents/item/feature.ts';

export interface FeaturePeekProps {
	feature: NimbleFeatureItem;
	/** The element the card sits beside. */
	anchor: HTMLElement;
	/** One extra line above the description, such as a note about duplicates. */
	note?: string;
}
