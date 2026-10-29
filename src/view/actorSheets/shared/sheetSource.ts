/**
 * The plain input of a sheet view model. An adapter builds these from `actor.reactive`;
 * a test or a story writes them by hand. Nothing here reads Foundry.
 */

/** Gives back the final words for a key in `public/lang/en.json`. */
export type Localize = (key: string) => string;

/** As `Localize`, and fills the `{name}` slots of the string. */
export type Format = (key: string, data: Record<string, string>) => string;

export interface RuleLike {
	id: string;
	type: string;
	/** not disabled, and its predicate is true now */
	active: boolean;
	/** the number that a `value` formula gives now; absent when the rule has no number */
	amount?: number;
	/** the other fields of the rule, as stored */
	fields: Record<string, unknown>;
}

export interface ItemLike {
	id: string;
	uuid: string;
	name: string;
	img: string;
	type: string;
	system: Record<string, unknown>;
	rules: RuleLike[];
}

export interface EffectLike {
	id: string;
	name: string;
	img: string;
	disabled: boolean;
	statuses: string[];
	/** the uuid of the document that made the effect */
	origin: string | null;
	/** the item that holds the effect; null for an effect on the actor */
	itemId: string | null;
	/** the effect is on because a toggle effect rule of this item is on */
	toggle: { itemId: string; ruleId: string } | null;
	/** a timed or one-off effect, not one that an item keeps on */
	temporary: boolean;
	/** how long it lasts, in words; empty for no end */
	duration: string;
	description: string;
}

/** A condition of the system, on the actor or not. */
export interface ConditionLike {
	id: string;
	name: string;
	img: string;
	active: boolean;
	/** plain text */
	description: string;
	/** how long it lasts, in words; empty for no end */
	duration: string;
	/** the name of the effect that gives it, if any */
	source: string;
}

export interface DicePoolLike {
	id: string;
	label: string;
	icon?: string;
	/** for example `d6` */
	dieSize: string;
	max: number;
	faces: number[];
}

export interface ChargePoolLike {
	id: string;
	label: string;
	icon?: string;
	current: number;
	max: number;
	temporary?: number;
	/** for example `d8`: each charge is a die that you roll when you spend it */
	dieSize: string | null;
	hidden: boolean;
	/** the author put the pool in the header */
	showAsResource: boolean;
}
