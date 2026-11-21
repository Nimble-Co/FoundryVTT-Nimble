import type { UseOption, UseOptionGroup } from '#types/useOption.d.ts';
import { rulesOfType } from '#utils/actor/actorRules.js';
import type { UseOptionRule } from '../../models/rules/useOption.js';
import {
	buildEffectiveChargePoolMap,
	findChargePoolByIdentifier,
	isCharacterActor,
} from '../chargePool/helpers.js';
import { hasRuleCharge } from '../chargePool/ruleChargeGate.js';
import localize from '../localize.js';

/** A set mana cost as a whole number of 0 or more, or null when the option does not set it. */
function manaSetOf(value: unknown): number | null {
	if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
	return Math.max(0, Math.trunc(Number(value)));
}

function useOptionOfRule(actor: Actor | null | undefined, rule: UseOptionRule): UseOption {
	const key = rule.key;
	const pool = String(rule.chargePoolIdentifier ?? '').trim();
	return {
		key,
		name: rule.resourceCost.source ?? '',
		cost: { ...rule.resourceCost, id: key },
		chargePoolIdentifier: pool,
		actionCostChange: rule.actionCostChange,
		rangePerMana: Math.max(0, Math.trunc(Number(rule.rangePerMana) || 0)),
		cardNote: String(rule.cardNote ?? '').trim(),
		damageTypes: [...((rule.damageTypes as string[] | undefined) ?? [])],
		manaCostChange: rule.manaCostChange ?? null,
		freeCopy: rule.freeCopy === true,
		replacesSpellCost: rule.replacesSpellCost === true,
		manaSet: manaSetOf(rule.manaSet),
		effect: rule.effectAfterCast,
		used: pool ? !hasRuleCharge(actor, pool) : false,
		...(rule.pickList.length > 0 ? { picks: rule.pickList } : {}),
	};
}

/** The key of the group of the options that take the place of the spell's cost. */
export const SPEND_GROUP = 'spend';

/** Whether the pool gets its uses back at the start of a turn. */
function poolRefillsEachTurn(actor: Actor | null | undefined, identifier: string): boolean {
	if (!isCharacterActor(actor)) return false;
	const entry = findChargePoolByIdentifier(buildEffectiveChargePoolMap(actor), identifier);
	return (entry?.pool.recoveries ?? []).some(
		(recovery) => recovery.trigger === 'onTurnStart' || recovery.trigger === 'onAnyTurnStart',
	);
}

function poolLabel(actor: Actor | null | undefined, identifier: string): string {
	if (!isCharacterActor(actor)) return identifier;
	const entry = findChargePoolByIdentifier(buildEffectiveChargePoolMap(actor), identifier);
	return entry?.pool.label || identifier;
}

/**
 * The Spell or Attack Options the actor can turn on where `appliesHere` holds: options that share
 * a Charge Pool make one group named after the pool, and an option with no pool is a group of its
 * own. The options that take the place of the spell's cost make one group, "Spend".
 */
export function useOptionGroups(
	actor: Actor | null | undefined,
	appliesHere: (rule: UseOptionRule) => boolean,
): UseOptionGroup[] {
	const groups = new Map<string, UseOptionGroup>();
	const rules = rulesOfType(actor as { rules?: unknown } | null, 'useOption').filter(
		(rule) => rule.appliesTo() && appliesHere(rule),
	);
	for (const rule of rules) {
		const option = useOptionOfRule(actor, rule);
		const pool = option.chargePoolIdentifier;
		const spend = option.replacesSpellCost;
		const key = spend ? SPEND_GROUP : pool ? `pool:${pool}` : `option:${option.key}`;
		const group = groups.get(key) ?? {
			key,
			label: spend
				? localize('NIMBLE.useOptions.spend')
				: pool
					? poolLabel(actor, pool)
					: option.name,
			used: !spend && option.used,
			refillsEachTurn: !spend && !!pool && poolRefillsEachTurn(actor, pool),
			spend,
			options: [],
		};
		group.options.push(option);
		groups.set(key, group);
	}
	return [...groups.values()];
}
