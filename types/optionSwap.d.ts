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

/** One of a pool's places: the pick standing in it, or nothing while it is empty. */
export interface OptionSwapPlace {
	/** Where the place sits in the pool's order, which is what the actions name it by. */
	index: number;
	/** The member standing in this place, or `null` while the place is empty. */
	feature: NimbleFeatureItem | null;
	/** Whether the member may be taken more than once, which the hover card says. */
	isRepeatable: boolean;
}

/** One member offered to fill an empty place. */
export interface OptionSwapChoice {
	feature: NimbleFeatureItem;
	isRepeatable: boolean;
}

/** What a pool's selection will do, in words, or nothing while it matches the holdings. */
export interface OptionSwapStatus {
	/** Whether the selection differs from what the sheet holds. */
	changed: boolean;
	/** Whether the rest would act on the selection as it stands. */
	isReady: boolean;
	text: string;
}

/** One option list inside a pool: the places its picks stand in, and what may fill them. */
export interface OptionSwapListView {
	/** The group the list draws from, or the uuid of an option granted outright. */
	key: string;
	heading: string;
	places: OptionSwapPlace[];
	choices: OptionSwapChoice[];
}

/** One pool as the section lays it out: its places, then what may fill an empty one. */
export interface OptionSwapPoolView {
	pool: ResolvedSwappableOptionPool;
	/** One entry per pick the character may hold, in a stable order. */
	places: OptionSwapPlace[];
	/** The members that may fill an empty place, by name. */
	choices: OptionSwapChoice[];
	/** The same places and choices, split by the list each member comes from. */
	lists: OptionSwapListView[];
	/** How many picks the selection holds, against what the levels grant. */
	countText: string;
	isOverGrant: boolean;
	isUnderGrant: boolean;
	hasEmptyPlace: boolean;
	/** What the levels grant against what the sheet holds. Empty while the two agree. */
	holdingsText: string;
	status: OptionSwapStatus;
	/** Whether the rest of the pool is unfolded. It starts folded to keep the section short. */
	showsChoices: boolean;
	choicesToggleLabel: string;
}

/** One card: the feature that makes the offer, with what its rules cover. */
export interface OptionSwapCardView {
	key: string;
	name: string;
	img: string;
	/** What this feature offers, in words: a swap, a skill move, or both. */
	subtitle: string;
	/** The id of the owned feature, for the hover card. Empty when no item carries the rule. */
	itemId: string;
	pools: OptionSwapPoolView[];
	offersSkillMove: boolean;
	/** Whether the pending selection gives this card's own feature up. */
	isGivenUp: boolean;
	givenUpText: string;
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
	 * balanced. An unplaced point is not a move.
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
