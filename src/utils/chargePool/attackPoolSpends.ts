import { runningRule } from '#utils/actor/actorRules.js';
import type { IncomingReactionEntry } from '../incomingReactions/incomingReactionEntry.js';
import { rulePoolState } from './ruleChargeGate.js';

/** What one attack has spent: the card's charge record and its card entries. */
interface AttackSpends {
	/** The card's `chargeConsumption` flag: what the use spent when it was made. */
	consumption: unknown;
	entries: IncomingReactionEntry[];
}

type PoolSpendingRule = {
	id?: string;
	type?: string;
	disabled?: boolean;
	poolIdentifier?: string;
	chargePoolIdentifier?: string;
};

/** The identifier of the attacker's charge pool that an entry spends from, or ''. */
function attackerPoolIdentifier(entry: IncomingReactionEntry): string {
	const rule = runningRule<PoolSpendingRule>(entry.itemUuid, entry.ruleId);
	if (entry.kind === 'spendPoolForDamage') {
		return rule?.type === 'chargeConsumer' ? (rule.poolIdentifier ?? '') : '';
	}
	if (entry.kind === 'reroll' && entry.side === 'roller') return rule?.chargePoolIdentifier ?? '';
	return '';
}

function poolKeyOf(entry: IncomingReactionEntry): string | null {
	const identifier = attackerPoolIdentifier(entry).trim();
	if (!identifier) return null;
	const actor = fromUuidSync(entry.actorUuid as `Actor.${string}`) as Actor | null;
	return rulePoolState(actor, identifier)?.key ?? null;
}

/**
 * Whether the entry would spend a second time, on one attack, from a charge
 * pool of the attacker that the attack already spent from.
 */
export function spendsPoolAgain(entry: IncomingReactionEntry, attack: AttackSpends): boolean {
	const key = poolKeyOf(entry);
	if (!key) return false;
	const consumption = Array.isArray(attack.consumption)
		? (attack.consumption as Array<{ poolId?: string; change?: number }>)
		: [];
	if (consumption.some((spent) => spent.poolId === key && Number(spent.change) < 0)) return true;
	return attack.entries.some(
		(other) => other.id !== entry.id && other.used && poolKeyOf(other) === key,
	);
}
