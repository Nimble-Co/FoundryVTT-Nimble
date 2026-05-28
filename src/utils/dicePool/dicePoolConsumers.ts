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
};

function readEffectFormula(consumer: DiceConsumerRuleLike): string | null {
	const value = (consumer as { effectFormula?: unknown }).effectFormula;
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
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

			const effectFormula = readEffectFormula(consumer);
			if (effectFormula === null) continue;

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
			});
		}
	}

	return consumers.sort((a, b) => a.itemName.localeCompare(b.itemName));
}

export { getDicePoolConsumers };
export type { DicePoolConsumer };
