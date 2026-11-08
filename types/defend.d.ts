import type { AttackerCondition } from '#types/attackerCondition.d.ts';
import type { PaidUseCost, UseCost } from '#types/useCost.d.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.js';
import type { DefendOptionOutcome, DefendOptionRule } from '../src/models/rules/defendOption.js';

export type DefendOutcome = DefendOptionOutcome;

/** An attack card, or the part of one that the Defend code reads. */
export type DefendCardLike = {
	system: unknown;
	speaker?: { scene?: string | null; token?: string | null; actor?: string | null } | null;
};

/** A Defend option the hero used, with what it cost so an undo can give it back. */
export interface DefendOptionUse {
	/** The hero who used and paid for it. */
	actorUuid: string;
	ruleId: string;
	itemUuid: string;
	label: string;
	cost: UseCost | null;
	paid: PaidUseCost | null;
}

/**
 * `action`: the Defend reaction and its action; `free`: the reaction only;
 * `extra`: a second Defend this round; `round`: covered by a Defend that lasts
 * the round.
 */
export type DefendRecordWay = 'action' | 'free' | 'extra' | 'round';

/** One hero's Defend against an attack card, as the card stores it. */
export interface DefendRecord {
	id: string;
	/** The Defended token: the attack's damage to it loses `armor`. */
	tokenUuid: string;
	actorUuid: string;
	armor: number;
	/** The GM turns this off for damage that cannot be avoided (Core:502). */
	armorApplies: boolean;
	/** The feature the hero Defended with; empty for the heroic reaction. */
	label: string;
	userId: string;
	combatantId: string;
	/** Actions the Defend spent, so an undo can give back those and no more. */
	actionsSpent: number | null;
	reactionKeys: string[];
	/** From the Defend options: the attack misses, no damage, or half in place of the armor. */
	outcome: DefendOutcome;
	/** Armor the Defend options add. */
	armorBonus: number;
	options: DefendOptionUse[];
	/** Lines for the table: what the hero may do now. */
	reminders: string[];
	/** The GM puts these conditions on the attacker. */
	attackerConditions: AttackerCondition[];
	/** How the Defend was paid. */
	way: DefendRecordWay;
}

/** What a Defend does to its token's damage from this card. */
export interface DefendEffect {
	armor: number;
	zero: boolean;
	halve: boolean;
}

/** A Defend option one hero can use against one attack card. */
export interface DefendOptionPick {
	key: string;
	label: string;
	rule: DefendOptionRule;
}

/** A button for a hero whose option reacts when an ally Defends. */
export interface AllyDefendOffer {
	key: string;
	defendId: string;
	actor: Actor.Implementation;
	pick: DefendOptionPick;
	defenderName: string;
}

/** A hero who can react to an attack card: Defend as a target, or Interpose for an ally. */
export interface DefendReactor {
	actor: Actor.Implementation;
	/** The hero's own token among the targets, when the attack hits them. */
	targetTokenUuid: string | null;
	/** Unused Interpose offers this hero has on the card. */
	interposes: IncomingReactionEntry[];
	defend: DefendRecord | null;
}

/** What a hero asks for outside the card: a Defend, an Interpose, or both. */
export type DefendWay = 'defend' | 'interpose' | 'both';

/** A point in a combat, so a 1/round use can tell when the hero's own turn came back. */
export interface RoundMark {
	combatId: string;
	round: number;
	turn: number;
}

/** A Defend that covers every attack on the hero until their own turn begins. */
export interface WholeRoundDefend extends RoundMark {
	label: string;
	armorBonus: number;
	outcome: string;
	messageId: string;
	recordId: string;
}
