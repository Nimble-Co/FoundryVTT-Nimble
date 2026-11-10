import type { ConditionalBonusRule } from '../../models/rules/conditionalBonus.js';
import { type AttackDelivery, attackDeliveryFromAttackType } from '../damage/attackDelivery.js';
import localize from '../localize.js';
import { getToggledTargetTags } from './toggledEffects.js';

/**
 * Discovery + target-domain helpers for the `conditionalBonus` rule. The activation
 * dialog uses these to surface the player's per-attack choice (advantage vs. bonus
 * damage) and the activation manager applies the picked effect to the roll.
 */

interface ConditionalBonusOption {
	/**
	 * Stable per-attack key for the dialog's choice map and `{#each}`. Rule ids are only
	 * unique within an item, so two copies of the same item (or copy-pasted homebrew)
	 * would collide on `rule.id` alone; scoping by the owning item's uuid keeps them
	 * distinct.
	 */
	key: string;
	label: string;
	advantage: number;
	/** Resolved numeric damage (null when dice-based or no damage offered). */
	damageValue: number | null;
	/** Raw dice damage formula (null when numeric or no damage offered). */
	damageFormula: string | null;
	damageType: string;
	/** The item of the attack doubles this bonus. */
	doubled?: boolean;
}

interface AttackingActor {
	rules?: unknown[];
	getFlag(scope: string, key: string): unknown;
}

interface TargetActor {
	uuid?: string | null;
	getTargetDomain?: () => Set<string>;
}

interface ActivationItem {
	type?: string;
	identifier?: string;
	system?: { activation?: { targets?: { attackType?: string } } };
}

/** Maps an item's attack type to a delivery channel. */
function getDelivery(item: ActivationItem): AttackDelivery {
	return attackDeliveryFromAttackType(item.system?.activation?.targets?.attackType);
}

/**
 * Builds the target domain used to evaluate conditional-bonus target conditions: the
 * target's own `target:*` tags plus any relational `target:<flagKey>` tags the attacker
 * has placed on this target (e.g. `target:quarry`). Mirrors the manager's roll-time
 * domain so the dialog choice matches what actually applies.
 */
function buildTargetDomain(
	attacker: AttackingActor | null | undefined,
	targetActor: TargetActor | null | undefined,
): Set<string> {
	const domain = new Set<string>(targetActor?.getTargetDomain?.() ?? []);
	for (const tag of getToggledTargetTags(attacker, targetActor)) domain.add(tag);
	return domain;
}

/** The attack's item asks to double the damage. Heroes and monsters with no armor have none. */
function doublesDamage(
	rule: ConditionalBonusRule,
	item: ActivationItem,
	targetActor: TargetActor | null | undefined,
): boolean {
	const entry = rule.doubleFor?.find((each) => each.source === item.identifier);
	if (!entry) return false;
	if (!entry.onlyNoArmor) return true;
	const armor = foundry.utils.getProperty(targetActor ?? {}, 'system.attributes.armor');
	return armor !== 'medium' && armor !== 'heavy';
}

/**
 * Returns the conditional bonuses currently offered to `attacker` for an attack with
 * `item` against `targetActor`. A bonus is offered when its self-predicate passes, its
 * delivery/source matches the attack, its target condition matches, and it grants at
 * least one of advantage or damage.
 */
function getActiveConditionalBonuses(
	attacker: AttackingActor | null | undefined,
	item: ActivationItem | null | undefined,
	targetActor: TargetActor | null | undefined,
): ConditionalBonusOption[] {
	if (!attacker || !item) return [];

	const rules = (attacker.rules ?? []) as ConditionalBonusRule[];
	const delivery = getDelivery(item);
	// Anything that isn't a spell is treated as a weapon source, so feature and
	// monster-attack activations also satisfy a `source: "weapon"` restriction. Fine
	// for the current rules; a future author wanting to distinguish them will need a
	// finer source mapping here.
	const source = item.type === 'spell' ? 'spell' : 'weapon';
	const targetDomain = buildTargetDomain(attacker, targetActor);

	const options: ConditionalBonusOption[] = [];
	for (const rule of rules) {
		if (rule.type !== 'conditionalBonus') continue;
		if (!rule.appliesTo()) continue;
		if (!rule.matchesAttack(delivery, source)) continue;
		if (!rule.matchesTarget(targetDomain)) continue;
		if (!rule.offersAdvantage() && !rule.offersDamage()) continue;

		const damage = rule.resolveDamage();
		const doubled = doublesDamage(rule, item, targetActor);
		options.push({
			key: `${rule.parentDocument?.uuid ?? ''}:${rule.id}`,
			label:
				rule.label || rule.parentDocument?.name || localize('NIMBLE.ruleTypes.conditionalBonus'),
			advantage: rule.offersAdvantage() ? rule.advantage : 0,
			damageValue: damage.value === null ? null : damage.value * (doubled ? 2 : 1),
			damageFormula: damage.formula && doubled ? `(${damage.formula})*2` : damage.formula,
			damageType: rule.damageType ?? '',
			...(doubled ? { doubled } : {}),
		});
	}

	return options;
}

export { type ConditionalBonusOption, buildTargetDomain, getActiveConditionalBonuses };
