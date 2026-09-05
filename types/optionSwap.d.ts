import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SwappableOptionPool } from '#utils/collectSwappableOptions.ts';
import type { OptionSwapOffer } from '#utils/resolveOptionSwapOffer.ts';

/** A swappable pool with its members resolved to documents the picker can render. */
export interface ResolvedSwappableOptionPool extends SwappableOptionPool {
	/** Compendium source uuid to the embedded item id the character holds for it. */
	itemIdByUuid: ReadonlyMap<string, string>;
	candidates: NimbleFeatureItem[];
}

/** Everything a rest surface needs to offer a swap. */
export interface ResolvedOptionSwapOffer extends OptionSwapOffer {
	pools: ResolvedSwappableOptionPool[];
}
