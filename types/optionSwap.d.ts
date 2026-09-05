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

/** What a rest dialog hands back when the player changed something. */
export interface OptionSwapSubmitData {
	pools: ResolvedSwappableOptionPool[];
	/** Pool key to the uuids the player wants to hold from that pool. */
	selections: ReadonlyMap<string, readonly string[]>;
	/** Skill key to its new point total. A move is net zero across the map. */
	skillPoints: ReadonlyMap<string, number>;
}
