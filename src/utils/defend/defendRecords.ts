import {
	DEFEND_OPTION_OUTCOMES,
	type DefendOptionOutcome,
} from '../../models/rules/defendOption.js';
import type { PaidRerollCost, RerollCost } from '../reroll/rerollCost.js';

export type DefendOutcome = DefendOptionOutcome;

/** A Defend option the hero used, with what it cost so an undo can give it back. */
export interface DefendOptionUse {
	/** The hero who used and paid for it. */
	actorUuid: string;
	ruleId: string;
	itemUuid: string;
	label: string;
	cost: RerollCost | null;
	paid: PaidRerollCost | null;
}

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
	/** Actions before the Defend was paid, so an undo can give them back. */
	previousActions: number | null;
	reactionKeys: string[];
	/** From the Defend options: the attack misses, no damage, or half in place of the armor. */
	outcome: DefendOutcome;
	/** Armor the Defend options add. */
	armorBonus: number;
	options: DefendOptionUse[];
	/** Lines for the table: what the hero may do now. */
	reminders: string[];
	/** The GM puts these conditions on the attacker. */
	attackerConditions: string[];
	/** How the Defend was paid. */
	way: DefendRecordWay;
}

/**
 * `action`: the Defend reaction and its action; `free`: the reaction only;
 * `extra`: a second Defend this round; `round`: covered by a Defend that lasts
 * the round.
 */
export type DefendRecordWay = 'action' | 'free' | 'extra' | 'round';
export const DEFEND_RECORD_WAYS: readonly DefendRecordWay[] = ['action', 'free', 'extra', 'round'];

function isDefendRecord(value: unknown): value is DefendRecord {
	const record = value as Partial<DefendRecord> | null;
	return (
		typeof record?.id === 'string' &&
		typeof record.tokenUuid === 'string' &&
		typeof record.actorUuid === 'string'
	);
}

export function defendsOf(system: unknown): DefendRecord[] {
	const defends = (system as { defends?: unknown } | null)?.defends;
	if (!Array.isArray(defends)) return [];
	return defends.filter(isDefendRecord).map((record) => ({
		...record,
		armor: Math.max(0, Math.floor(Number(record.armor) || 0)),
		armorApplies: record.armorApplies !== false,
		label: record.label ?? '',
		userId: record.userId ?? '',
		combatantId: record.combatantId ?? '',
		previousActions: record.previousActions ?? null,
		reactionKeys: Array.isArray(record.reactionKeys) ? record.reactionKeys : [],
		outcome: DEFEND_OPTION_OUTCOMES.includes(record.outcome) ? record.outcome : 'none',
		armorBonus: Math.max(0, Math.floor(Number(record.armorBonus) || 0)),
		options: Array.isArray(record.options) ? record.options : [],
		reminders: Array.isArray(record.reminders)
			? record.reminders.filter((line) => typeof line === 'string')
			: [],
		attackerConditions: Array.isArray(record.attackerConditions)
			? record.attackerConditions.filter((id) => typeof id === 'string')
			: [],
		way: DEFEND_RECORD_WAYS.includes(record.way) ? record.way : 'action',
	}));
}

/** What a Defend does to its token's damage from this card. */
export interface DefendEffect {
	armor: number;
	zero: boolean;
	halve: boolean;
}

/**
 * Per Defended token: the armor that comes off, or no damage, or half. "Armor
 * applies" off stops the armor and the halving; a miss stays.
 */
export function defendEffectsOf(system: unknown): Map<string, DefendEffect> {
	const effects = new Map<string, DefendEffect>();
	for (const defend of defendsOf(system)) {
		const zero = defend.outcome === 'miss' || defend.outcome === 'noDamage';
		const halve = defend.armorApplies && defend.outcome === 'halve';
		const armor = defend.armorApplies && !halve ? defend.armor + defend.armorBonus : 0;
		effects.set(defend.tokenUuid, { armor, zero, halve });
	}
	return effects;
}

export function defendFor(system: unknown, tokenUuid: string): DefendRecord | null {
	return defendsOf(system).find((record) => record.tokenUuid === tokenUuid) ?? null;
}

/** The targets whose damage from this card is applied. */
export function damageAppliedTo(system: unknown): Set<string> {
	const applied = (system as { damageAppliedTo?: unknown } | null)?.damageAppliedTo;
	return new Set(Array.isArray(applied) ? applied.filter((uuid) => typeof uuid === 'string') : []);
}

/** Whether the card can hold Defends at all. */
export function cardTakesDefends(system: unknown): boolean {
	return Array.isArray((system as { defends?: unknown } | null)?.defends);
}
