import type { NimbleAncestryItem } from '../../../documents/item/ancestry';

export default function prepareAncestryMetadata(ancestry: NimbleAncestryItem): string {
	const { sizeCategories } = CONFIG.NIMBLE;
	const sortingReferenceArray = Object.keys(sizeCategories);

	return ancestry.system?.size
		?.map((size) => sizeCategories[size] ?? size)
		?.sort((a, b) => {
			if (!a) return -1;
			if (!b) return 1;

			return sortingReferenceArray.indexOf(a) - sortingReferenceArray.indexOf(b);
		})
		?.join(' / ');
}
