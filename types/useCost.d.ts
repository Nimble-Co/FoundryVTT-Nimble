import type { HeroicReactionKey } from '#utils/incomingReactions/heroicActions.js';

/**
 * What one use of a reroll, a Defend option or a dice pool costs. Every part
 * is optional; zero or blank is free.
 */
export interface UseCost {
	chargePoolIdentifier: string;
	chargeCost: number;
	manaCost: number;
	woundCost: number;
	heroicReaction: HeroicReactionKey | '';
	/** Actions a hero spends in combat. Absent is none. */
	actionCost?: number;
	/** The mana, charges and Wounds are per die the player picks. */
	perDie?: boolean;
	/** With no action left the use still goes on, and the card says so. */
	actionReportOnly?: boolean;
	/** The rule can be used once per turn of any creature. */
	turnUseKey?: string;
	/** Every die of this dice pool is expended; it needs at least one. */
	dicePoolIdentifier?: string;
}

/** What was actually charged, so an undo or a failed use can give it back. */
export interface PaidUseCost {
	charges: number;
	mana: number;
	wounds: number;
	heroicReaction: {
		combatId: string;
		combatantId: string;
		key: HeroicReactionKey;
		actionsSpent: number;
	} | null;
	/** Actions spent: now on the hero's own turn, else from their next turn. */
	action: { combatId: string; combatantId: string; amount: number; now: boolean } | null;
	/** The action cost could not be paid, and the rule only reports that. */
	noActionLeft?: boolean;
	/** A 1/turn use was spent. */
	turnUse?: boolean;
	/** The dice expended from a dice pool. */
	dice?: { poolId: string; faces: number[] } | null;
	/** The combat turn when an action or a heroic reaction was paid. */
	stamp?: TurnStamp | null;
}

/** A combat turn: the combat, the round, the combatant whose turn it is, and its turn index. */
export interface TurnStamp {
	combatId: string;
	round: number;
	combatantId: string;
	/** Absent on records from before the index was stored. */
	turn?: number | null;
}

/** Who pays a cost. */
export type CostPayer = Actor | null | undefined;
