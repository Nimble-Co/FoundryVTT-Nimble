import type { EffectNode } from '#types/effectTree.js';
import type { ActiveMaxDamage, MaxDamageChoice } from '#types/maxDamage.d.ts';
import { ruleLabel } from '#utils/actor/actorRules.js';
import type { DamageRoll } from '../../dice/DamageRoll.js';
import { spendRuleCharge } from '../../utils/chargePool/ruleChargeGate.js';
import { maxDamageRuleOf } from '../../utils/damage/maxDamageOffers.js';

export function resolveMaxDamage(
	actor: Parameters<typeof maxDamageRuleOf>[0],
	item: Parameters<typeof maxDamageRuleOf>[1],
	choice: MaxDamageChoice | null | undefined,
): ActiveMaxDamage | null {
	const rule = maxDamageRuleOf(actor, item, choice);
	return rule ? { rule, tempHp: choice?.tempHp === true } : null;
}

/** Make the attack roll a max damage roll, when the rule is for damage. */
export function applyMaxDamageToRollOptions(
	options: DamageRoll.Options,
	maxDamage: ActiveMaxDamage | null,
	canCrit: boolean,
): void {
	if (maxDamage?.rule.use !== 'damage') return;
	const { rule } = maxDamage;
	options.maxDamage = rule.givesCrit && canCrit ? 'crit' : 'hit';
	options.outcomeSources = {
		...options.outcomeSources,
		maxDamage: [ruleLabel(rule)],
	};
}

/** Whether this node heals at max. It then has the choice and the name of the rule. */
export function prepareHealingAtMax(node: EffectNode, maxDamage: ActiveMaxDamage | null): boolean {
	if (node.type !== 'healing' || maxDamage?.rule.use !== 'healing') return false;
	const { rule, tempHp } = maxDamage;
	if (tempHp) (node as { healingType?: string }).healingType = 'tempHealing';
	(node as { maxDamageBy?: string }).maxDamageBy = ruleLabel(rule);
	return true;
}

/** Every roll of this activation has max dice, so no die is thrown. */
export function noDiceThrown(
	maxDamage: ActiveMaxDamage | null,
	rolls: ReadonlyArray<Roll | DamageRoll>,
	healingRollsAtMax: ReadonlySet<Roll | DamageRoll>,
): boolean {
	return (
		maxDamage !== null &&
		rolls.every(
			(roll) =>
				roll.dice.length === 0 ||
				(roll as DamageRoll).noDice === true ||
				healingRollsAtMax.has(roll),
		)
	);
}

export async function spendMaxDamageCharge(
	actor: Parameters<typeof spendRuleCharge>[0],
	maxDamage: ActiveMaxDamage | null,
): Promise<void> {
	const rule = maxDamage?.rule;
	if (rule?.chargePoolIdentifier) {
		await spendRuleCharge(actor, rule.chargePoolIdentifier, rule.chargeCost ?? 1);
	}
}
