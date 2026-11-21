import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { SpellCostActorLike, SpellLike } from '#types/spellCost.d.ts';
import type {
	ActionCostChange,
	ChosenUseOption,
	CostChange,
	PoolUse,
	UseOption,
	UseOptionEffect,
	UseOptionGroup,
} from '#types/useOption.d.ts';
import { rulesOfType } from '#utils/actor/actorRules.js';
import type { UseOptionRule } from '../../models/rules/useOption.js';
import {
	buildEffectiveChargePoolMap,
	findChargePoolByIdentifier,
	isCharacterActor,
} from '../chargePool/helpers.js';
import { hasRuleCharge } from '../chargePool/ruleChargeGate.js';
import { withActionCostChange } from '../combat/withActionCostChange.js';
import { castManaCostOf } from '../cost/castManaCost.js';
import { settleResourceCost } from '../cost/resourceCost.js';
import localize from '../localize.js';
import { exceedsUnlockedSpellTier } from './spellCost.js';

type OptionSpell = Parameters<UseOptionRule['appliesToSpell']>[0];
type OptionWeapon = Parameters<UseOptionRule['appliesToWeapon']>[0];

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
 * The Spell or Attack Options the caster can turn on for this spell: options that share a
 * Charge Pool make one group named after the pool, and an option with no pool is a group of
 * its own. The options that take the place of the spell's cost make one group, "Spend".
 */
export function spellUseOptionGroups(
	actor: Actor | null | undefined,
	spell: OptionSpell,
): UseOptionGroup[] {
	if (exceedsUnlockedSpellTier(actor as SpellCostActorLike, spell as SpellLike)) return [];
	return useOptionGroups(actor, (rule) => rule.appliesToSpell(spell));
}

/** The Spell or Attack Options the attacker can turn on for this weapon, grouped as for a spell. */
export function weaponUseOptionGroups(
	actor: Actor | null | undefined,
	weapon: OptionWeapon,
): UseOptionGroup[] {
	return useOptionGroups(actor, (rule) => rule.appliesToWeapon(weapon));
}

function useOptionGroups(
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

/** Whether an option the dialog of this item offers can change the actions the use costs. */
export function offersActionCostChange(actor: Actor | null | undefined, item: unknown): boolean {
	const spell = item as OptionSpell;
	if (spell?.type !== 'spell') return false;
	return spellUseOptionGroups(actor, spell).some((group) =>
		group.options.some((option) => option.actionCostChange !== null),
	);
}

/** What the options the player turned on cost and change, with their amounts settled. */
export interface ChosenUseOptions {
	costs: ResourceCost[];
	/** The pools whose uses the options spend, one use each. */
	pools: PoolUse[];
	actionCostChanges: ActionCostChange[];
	/** Range the options add to the spell. */
	range: number;
	/** The lines the options put on the card. */
	notes: string[];
	/** The damage type the spell deals in place of its own, or '' for its own. */
	damageType: string;
	/** The name of the option that posts a free copy of the cast, or ''. */
	freeCopy: string;
	/** The effects the caster gains after the cast. */
	effects: UseOptionEffect[];
}

/** What a use with no option turned on costs and changes: nothing. */
export function noChosenUseOptions(): ChosenUseOptions {
	return {
		costs: [],
		pools: [],
		actionCostChanges: [],
		range: 0,
		notes: [],
		damageType: '',
		freeCopy: '',
		effects: [],
	};
}

/** The options the player chose, at most one in each group, read against the groups offered. */
function pickedOptions(
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[],
): Array<{ group: UseOptionGroup; option: UseOption; choice: ChosenUseOption }> {
	return groups.flatMap((group) => {
		const choice = chosen.find((each) => group.options.some((option) => option.key === each.key));
		const option = group.options.find((each) => each.key === choice?.key);
		return option && choice ? [{ group, option, choice }] : [];
	});
}

/** How the options the player chose change what the spell itself costs. */
export interface CastCostChange {
	/** An option's cost takes the place of the spell's cost. */
	replacesSpellCost: boolean;
	/** The mana the spell costs at its own tier, or null for no change. */
	manaSet: number | null;
	/** How the options change the mana cost of the spell. */
	manaCostChanges: CostChange[];
}

/**
 * The mana of the spell at its tier mana `mana`, in the order the cast spends it: less mana takes
 * 1 first, then a set mana is final, else each change of the chosen options applies. A cast that
 * costs no mana stays free.
 */
export function spellManaWithOptions(
	mana: number,
	change: Pick<CastCostChange, 'manaSet' | 'manaCostChanges'> & { lessMana?: boolean },
): number {
	const left = change.lessMana && mana > 0 ? mana - 1 : mana;
	if (left <= 0) return 0;
	if (change.manaSet !== null) return change.manaSet;
	return change.manaCostChanges.reduce(withActionCostChange, left);
}

export function chosenCastCostChange(
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
): CastCostChange {
	const picked = pickedOptions(groups, chosen).map(({ option }) => option);
	const set = picked.find((option) => option.manaSet !== null);
	return {
		replacesSpellCost: picked.some((option) => option.replacesSpellCost),
		manaSet: set?.manaSet ?? null,
		manaCostChanges: picked.flatMap((option) => option.manaCostChange ?? []),
	};
}

/**
 * What the options the player chose cost and change. `castMana` is the mana the cast spends on
 * the spell, which a cost can read as `@castManaSpent`. Null, with a notice, when the cost of an
 * option cannot be worked out.
 */
export async function settleChosenUseOptions(
	actor: Actor | null | undefined,
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
	castMana = 0,
): Promise<ChosenUseOptions | null> {
	const settled = noChosenUseOptions();
	for (const { group, option, choice } of pickedOptions(groups, chosen)) {
		const castCost = castManaCostOf(actor, option.cost, castMana);
		if (!castCost) {
			ui.notifications?.error(localize('NIMBLE.useOptions.badCostFormula', { name: option.name }));
			return null;
		}
		const cost = await settleResourceCost(actor as never, castCost, choice.amount);
		if (Number(cost.amount) > 0) settled.costs.push(cost);
		if (option.chargePoolIdentifier) {
			settled.pools.push({ identifier: option.chargePoolIdentifier, label: group.label });
		}
		if (option.actionCostChange) settled.actionCostChanges.push(option.actionCostChange);
		settled.range += option.rangePerMana * Number(cost.amount);
		if (choice.damageType && option.damageTypes.includes(choice.damageType)) {
			settled.damageType = choice.damageType;
		}
		if (option.cardNote) {
			settled.notes.push(option.cardNote.replaceAll('{amount}', String(cost.amount)));
		}
		if (option.freeCopy) settled.freeCopy = option.name;
		if (option.effect) settled.effects.push(option.effect);
	}
	return settled;
}
