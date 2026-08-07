import { effectiveSizes } from '#utils/sizeSelection.js';
import type { NimbleAncestryItem } from '../../../documents/item/ancestry.js';

export default function prepareAncestryMetadata(ancestry: NimbleAncestryItem): string {
	const { sizeCategories } = CONFIG.NIMBLE;

	// Sorted by size key, then labelled — sorting the labels would compare them against keys.
	return effectiveSizes(ancestry.system?.size, Object.keys(sizeCategories))
		.map((size) => sizeCategories[size] ?? size)
		.join(' / ');
}
