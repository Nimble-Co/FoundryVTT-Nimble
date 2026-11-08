import type { DefendEffect, DefendRecord, DefendRecordWay } from '#types/defend.d.ts';
import { DEFEND_OPTION_OUTCOMES } from '../../models/rules/defendOption.js';

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
		actionsSpent: record.actionsSpent ?? null,
		reactionKeys: Array.isArray(record.reactionKeys) ? record.reactionKeys : [],
		outcome: DEFEND_OPTION_OUTCOMES.includes(record.outcome) ? record.outcome : 'none',
		armorBonus: Math.max(0, Math.floor(Number(record.armorBonus) || 0)),
		options: Array.isArray(record.options) ? record.options : [],
		reminders: Array.isArray(record.reminders)
			? record.reminders.filter((line) => typeof line === 'string')
			: [],
		attackerConditions: Array.isArray(record.attackerConditions)
			? record.attackerConditions
					.filter((each) => typeof each?.condition === 'string')
					.map((each) => ({
						condition: each.condition,
						endsOnAttackerTurn: each.endsOnAttackerTurn === true,
					}))
			: [],
		way: DEFEND_RECORD_WAYS.includes(record.way) ? record.way : 'action',
	}));
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
