import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SwappableOptionPool } from '#utils/collectSwappableOptions.ts';
import type { OptionSwapOffer } from '#utils/resolveOptionSwapOffer.ts';

/** A swappable pool with its members resolved to documents the picker can render. */
export interface ResolvedSwappableOptionPool extends SwappableOptionPool {
	candidates: NimbleFeatureItem[];
}

/** Everything a rest surface needs to offer a swap. */
export interface ResolvedOptionSwapOffer extends OptionSwapOffer {
	pools: ResolvedSwappableOptionPool[];
}

/** Everything the swap section has picked so far, handed over whole on every change. */
export interface OptionSwapChange {
	/**
	 * Pool key to the uuids the player wants to hold from that pool. A uuid appears once per
	 * pick, so a repeated option is listed as many times as it is held.
	 */
	selections: Map<string, string[]>;
	/**
	 * Skill key to its new point total, for the skills a move changed. Empty until a move is
	 * balanced — an unplaced point is not a move.
	 */
	skillPoints: Map<string, number>;
}

/** What a rest dialog hands back when the player changed something. */
export interface OptionSwapSubmitData {
	pools: ResolvedSwappableOptionPool[];
	/** Pool key to the uuids the player wants to hold from that pool, once per pick. */
	selections: ReadonlyMap<string, readonly string[]>;
	/** Skill key to its new point total. A move is net zero across the map. */
	skillPoints: ReadonlyMap<string, number>;
}
