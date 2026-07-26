import { isCharacterActor, normalizeIdentifier } from './helpers.js';
import type {
	CharacterActorLike,
	DiceConsumerRuleLike,
	DicePoolRuleAny,
	DicePoolState,
	RuleBackedItem,
} from './types.js';

type DicePoolConsumer = {
	itemId: string;
	itemName: string;
	itemImg: string | null;
	itemDescription: string;
	ruleId: string;
	ruleLabel: string;
	cost: string;
	effectFormula: string | null;
	effectType: string;
};

function readEffectFormula(consumer: DiceConsumerRuleLike): string | null {
	const value = (consumer as { effectFormula?: unknown }).effectFormula;
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

type ConsumerModifier = {
	effectTypeFilter: string;
	appendFormula: string;
};

/**
 * Collect enabled `modifyConsumer` rules across the actor that target the
 * given pool identifier. Rule predicates are respected via `appliesTo()`.
 * Sorted by rule priority so appended formulas compose in a stable order.
 */
function getConsumerModifiers(
	actor: CharacterActorLike,
	poolIdentifier: string,
): ConsumerModifier[] {
	const modifiers: Array<ConsumerModifier & { priority: number }> = [];

	for (const item of actor.items.contents) {
		const ruleBackedItem = item as RuleBackedItem;
		const rules = ruleBackedItem.rules;
		if (!rules) continue;

		for (const rawRule of rules.values()) {
			const rule = rawRule as {
				type?: string;
				disabled?: boolean;
				poolIdentifier?: string;
				effectTypeFilter?: string;
				appendFormula?: string;
				priority?: number;
				appliesTo?: () => boolean;
			};
			if (rule.type !== 'modifyConsumer' || rule.disabled) continue;
			if (normalizeIdentifier(rule.poolIdentifier) !== poolIdentifier) continue;
			if (typeof rule.appliesTo === 'function' && !rule.appliesTo()) continue;

			const appendFormula = typeof rule.appendFormula === 'string' ? rule.appendFormula.trim() : '';
			if (appendFormula.length < 1) continue;

			modifiers.push({
				effectTypeFilter: typeof rule.effectTypeFilter === 'string' ? rule.effectTypeFilter : '',
				appendFormula,
				priority: rule.priority ?? 0,
			});
		}
	}

	return modifiers.sort((a, b) => a.priority - b.priority);
}

/**
 * Append matching modifier formulas to a consumer's effect formula. Each
 * matching modifier contributes `+ (<appendFormula>)`.
 */
function applyConsumerModifiers(
	effectFormula: string,
	effectType: string,
	modifiers: ConsumerModifier[],
): string {
	let formula = effectFormula;
	for (const modifier of modifiers) {
		if (modifier.effectTypeFilter.length > 0 && modifier.effectTypeFilter !== effectType) continue;
		formula = `${formula} + (${modifier.appendFormula})`;
	}
	return formula;
}

/**
 * Enumerate manual-mode `diceConsumer` rules across the actor that target the
 * given pool. Used by the DicePoolPanel to populate its feature list:
 * features the player can pick when committing dice from the pool.
 *
 * Filters:
 *   - rule.type === 'diceConsumer' && !rule.disabled
 *   - rule.mode === 'manual'
 *   - rule.poolIdentifier matches pool.identifier
 *   - rule.poolScope matches pool.scope
 *   - effectFormula is present (consumers with no effect have no UX hook to
 *     advertise — they spend silently via the sheet's per-die click)
 */
function getDicePoolConsumers(
	actor: Actor | null | undefined,
	pool: DicePoolState,
): DicePoolConsumer[] {
	if (!isCharacterActor(actor)) return [];

	const characterActor = actor as CharacterActorLike;
	const poolIdentifier = normalizeIdentifier(pool.identifier);
	if (poolIdentifier.length < 1) return [];

	const consumers: DicePoolConsumer[] = [];
	const consumerModifiers = getConsumerModifiers(characterActor, poolIdentifier);

	for (const item of characterActor.items.contents) {
		const ruleBackedItem = item as RuleBackedItem;
		const rules = ruleBackedItem.rules;
		if (!rules) continue;

		for (const [ruleId, rawRule] of rules.entries()) {
			const rule = rawRule as DicePoolRuleAny;
			if (rule.type !== 'diceConsumer' || rule.disabled) continue;
			const consumer = rule as DiceConsumerRuleLike;
			if (consumer.mode !== 'manual') continue;
			if (normalizeIdentifier(consumer.poolIdentifier) !== poolIdentifier) continue;
			if ((consumer.poolScope ?? 'item') !== pool.scope) continue;

			const baseEffectFormula = readEffectFormula(consumer);
			if (baseEffectFormula === null) continue;

			const effectType =
				typeof consumer.effectType === 'string' && consumer.effectType.length > 0
					? consumer.effectType
					: 'generic';
			const effectFormula = applyConsumerModifiers(
				baseEffectFormula,
				effectType,
				consumerModifiers,
			);

			consumers.push({
				itemId: String(item.id),
				itemName: String(item.name ?? ''),
				itemImg: typeof item.img === 'string' ? item.img : null,
				itemDescription:
					typeof (item as unknown as { system?: { description?: unknown } }).system?.description ===
					'string'
						? (item as unknown as { system: { description: string } }).system.description
						: '',
				ruleId: String(ruleId),
				ruleLabel:
					typeof (rule as { label?: unknown }).label === 'string'
						? (rule as { label: string }).label
						: '',
				cost: typeof consumer.cost === 'string' ? consumer.cost : '1',
				effectFormula,
				effectType,
			});
		}
	}

	return consumers.sort((a, b) => a.itemName.localeCompare(b.itemName));
}

export { getDicePoolConsumers };
export type { DicePoolConsumer };
