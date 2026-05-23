import { MigrationBase } from '../MigrationBase.js';

type LegacyDicePoolRule = {
	type?: string;
	id?: string;
	identifier?: string;
	scope?: string;
	consumption?: string;
	bonusOnAttackDelivery?: string | null;
	[key: string]: unknown;
};

type DiceConsumerRule = {
	type: 'diceConsumer';
	disabled: boolean;
	id: string;
	identifier: string;
	label: string;
	predicate: Record<string, unknown>;
	priority: number;
	poolIdentifier: string;
	poolScope: 'item' | 'actor';
	mode: 'manual' | 'autoBonus';
	cost: string;
	bonusOnAttackDelivery: string | null;
};

function isLegacyDicePoolRule(rule: unknown): rule is LegacyDicePoolRule {
	if (!rule || typeof rule !== 'object') return false;
	const candidate = rule as Record<string, unknown>;
	if (candidate.type !== 'dicePool') return false;
	const hasConsumption = typeof candidate.consumption === 'string';
	const hasDelivery =
		candidate.bonusOnAttackDelivery !== undefined && 'bonusOnAttackDelivery' in candidate;
	return hasConsumption || hasDelivery;
}

function normalizeScope(value: unknown): 'item' | 'actor' {
	return value === 'actor' ? 'actor' : 'item';
}

function rulesHaveConsumerForPool(rules: unknown[], poolIdentifier: string): boolean {
	for (const rule of rules) {
		if (!rule || typeof rule !== 'object') continue;
		const candidate = rule as Record<string, unknown>;
		if (candidate.type !== 'diceConsumer') continue;
		if (typeof candidate.poolIdentifier !== 'string') continue;
		if (candidate.poolIdentifier === poolIdentifier) return true;
	}
	return false;
}

/**
 * Splits the legacy `consumption` / `bonusOnAttackDelivery` fields off the
 * `dicePool` rule and into a paired `diceConsumer` rule.
 *
 * - `consumption: 'autoBonus'` on a dicePool → inserts a `diceConsumer` rule
 *   with `mode: 'autoBonus'` (and the same `bonusOnAttackDelivery`).
 * - `consumption: 'manual'` (the default) → no consumer rule needed; manual
 *   spend goes through the dialog flow. Just strip the fields.
 *
 * Idempotent: skips dicePool rules that no longer carry the legacy fields, and
 * skips inserting a consumer if one already targets the same pool identifier.
 */
class Migration025DiceConsumerSplit extends MigrationBase {
	static override readonly version = 25;

	override readonly version = Migration025DiceConsumerSplit.version;

	override async updateItem(source: any): Promise<void> {
		const rules = source?.system?.rules;
		if (!Array.isArray(rules)) return;

		let mutated = false;
		const inserts: DiceConsumerRule[] = [];

		for (const rule of rules) {
			if (!isLegacyDicePoolRule(rule)) continue;

			const consumption = typeof rule.consumption === 'string' ? rule.consumption : null;
			const delivery =
				typeof rule.bonusOnAttackDelivery === 'string' ? rule.bonusOnAttackDelivery : null;
			const poolIdentifier =
				typeof rule.identifier === 'string' && rule.identifier.trim().length > 0
					? rule.identifier.trim()
					: typeof rule.id === 'string'
						? rule.id.trim()
						: '';
			const scope = normalizeScope(rule.scope);

			delete rule.consumption;
			delete rule.bonusOnAttackDelivery;
			mutated = true;

			if (consumption !== 'autoBonus') continue;
			if (poolIdentifier.length < 1) continue;
			if (rulesHaveConsumerForPool(rules, poolIdentifier)) continue;
			if (inserts.some((entry) => entry.poolIdentifier === poolIdentifier)) continue;

			inserts.push({
				type: 'diceConsumer',
				disabled: false,
				id: `${poolIdentifier}-autobonus`,
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				poolIdentifier,
				poolScope: scope,
				mode: 'autoBonus',
				cost: '1',
				bonusOnAttackDelivery: delivery,
			});
		}

		if (inserts.length > 0) {
			rules.push(...inserts);
			mutated = true;
		}

		if (mutated) {
			const label = source.name ?? source._id ?? '(unnamed)';
			const detail =
				inserts.length > 0
					? `added ${inserts.length} diceConsumer rule(s)`
					: 'stripped legacy consumption fields';
			console.log(`Nimble Migration | ${label}: ${detail}`);
		}
	}
}

export { Migration025DiceConsumerSplit };
