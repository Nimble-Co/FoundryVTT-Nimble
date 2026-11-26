import type {
	AttackDelivery,
	AutoBonusSummary,
	ChargeBonusFragment,
	PoolBonusEntry,
	SpendableChargePool,
	SpendablePool,
	VariableChargeSpend,
} from '#types/components/ItemActivationConfigDialog.d.ts';
import type { AppliedTicks } from '#types/conditionRollMode.d.ts';
import type { DualWieldOffer } from '#types/dualWield.d.ts';
import type { MaxDamageChoice, MaxDamageOffer } from '#types/maxDamage.d.ts';
import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { UseOptionGroup } from '#types/useOption.d.ts';
import {
	type ConditionalBonusOption,
	getActiveConditionalBonuses,
} from '#utils/actor/conditionalBonuses.js';
import { offersLessManaFor } from '#utils/chaos/lessMana.js';
import { fixedChargeCostsOf } from '#utils/chargePool/fixedChargeCosts.js';
import { itemOffersFreeUse } from '#utils/chargePool/helpers.js';
import { labelNote } from '#utils/chargePool/poolHeading.js';
import { rollWindowCostParts } from '#utils/cost/resourceCostWords.js';
import {
	type AttackActivation,
	deliveryOfAttack,
	matchesAttackDelivery,
} from '#utils/damage/attackDelivery.js';
import {
	applyDamageFormulaChoices,
	damageFormulaChoiceOffers,
} from '#utils/damage/damageFormulaChoice.js';
import { damageMultiplierOf } from '#utils/damage/damageMultiplier.js';
import { dualWieldOfferFor } from '#utils/damage/dualWield.js';
import { maxDamageOffers } from '#utils/damage/maxDamageOffers.js';
import {
	attackDistanceWith,
	groupWeapons,
	halfRangeOf,
	halfRangeText,
	type WeaponOption,
	weaponAttackOf,
	weaponOptionsFor,
} from '#utils/damage/weaponAttack.js';
import { keptAmountFor } from '#utils/heldChange/heldChange.js';
import localize from '#utils/localize.js';
import {
	rollModeWithoutConditions,
	tickedConditionRollModes,
} from '#utils/rolls/appliedConditionRollModes.js';
import { attackConditionLines } from '#utils/rolls/attackConditionLines.js';
import { MAX_ROLL_MODE, openRollModeTicks } from '#utils/rolls/rollModeTicks.js';
import { soleTarget } from '#utils/tokens/soleTarget.js';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { conditionRollModeOptions } from './components/conditionRollModeOptions.ts';
import { rollSpendLine } from './components/rollSpendLine.ts';
import { heldChangeChoice } from './heldChangeChoice.svelte.ts';
import {
	buildAutoBonusFormula,
	buildAutoBonusSummaries,
	extractDamageEffectsFromItem,
	extractRolledPools,
	extractSpendableChargePools,
	extractVariableChargeSpends,
} from './itemActivationConfigDialogHelpers.js';
import { resourceAmounts } from './resourceAmounts.svelte.ts';
import { useOptionSplits } from './useOptionSplits.svelte.ts';

type ConditionalChoice = 'advantage' | 'damage' | 'none';

/** "Bonus: +1d6 × 2 damage (+1 Reach)": a note in brackets on the label goes last. */
function conditionalBonusTick(label: string, damage: string): string {
	const text = 'NIMBLE.activationDialog.conditionalBonus';
	const { name, note } = labelNote(label);
	return note
		? localize(`${text}.tickWithNote`, { label: name, value: damage, note })
		: localize(`${text}.tick`, { label, value: damage });
}

export interface CreateItemActivationConfigDialogStateOptions {
	actor: () => Actor;
	item: () => Item;
	initialRollMode?: number;
	hideRollsDefault: boolean;
	/** The roll ignores disadvantage already, so the change that ignores it has no line. */
	ignoresDisadvantage?: boolean;
	/** The actions that this use spends. */
	spendsActions?: number;
	/** What this use spends or sacrifices through Spend or Sacrifice rules. */
	resourceCosts?: readonly ResourceCost[];
	/** The Spell or Attack Options the attacker can turn on for this weapon. */
	useOptionGroups?: readonly UseOptionGroup[];
	/** The identifier of the feature the attack is made through. */
	attackOrigin?: string;
	/** The extra targets share one attack, so the first target decides. */
	sharesOneAttack?: boolean;
}

export function createItemActivationConfigDialogState(
	options: CreateItemActivationConfigDialogStateOptions,
) {
	const { initialRollMode = 0, hideRollsDefault } = options;

	// Snapshot actor and item at dialog-open time — pools reflect what is
	// available when the player initiates the roll, not mid-dialog changes.
	const actor = options.actor();
	const item = options.item();

	const resources = resourceAmounts(actor, options.resourceCosts ?? []);
	const splits = useOptionSplits(actor, options.useOptionGroups ?? []);

	const allRolledPools = extractRolledPools(actor);
	const spendablePools: SpendablePool[] = allRolledPools.filter(
		(pool) => pool.consumption !== 'autoBonus',
	);
	const chargePoolsWithDie: SpendableChargePool[] = extractSpendableChargePools(actor);
	const variableChargeSpends: VariableChargeSpend[] = extractVariableChargeSpends(actor, item);

	// The actor that target tests read, taken when the dialog opens. None with two or more
	// targets, unless the first target decides for a single-target attack.
	const firstTargetActor = (
		soleTarget(game.user?.targets, {
			firstDecides:
				options.sharesOneAttack === true ||
				(item.system as { activation?: { targets?: { singleTargetAttack?: boolean } } }).activation
					?.targets?.singleTargetAttack === true,
		}) as Token | null
	)?.actor as { uuid?: string; getTargetDomain?: () => Set<string> } | undefined;
	const defaultConditionalChoice = (option: ConditionalBonusOption): ConditionalChoice => {
		if (option.startsChosen === false) return 'none';
		if (option.doubled) return 'damage';
		if (option.advantage > 0) return 'advantage';
		if (option.damageValue !== null || option.damageFormula !== null) return 'damage';
		return 'none';
	};

	const maxDamage: MaxDamageOffer[] = maxDamageOffers(actor as never, item as never);
	let maxDamageChoice = $state<MaxDamageChoice | null>(null);
	const offersLessMana = offersLessManaFor(actor as never, item as never);
	let lessMana = $state(false);
	const offersFreeUse =
		actor.type === 'character' && itemOffersFreeUse(actor as never, item as never);
	let freeUse = $state(false);
	const dualWieldOffer: DualWieldOffer | null = dualWieldOfferFor(actor as never, item as never);
	let dualWield = $state(false);
	let dualWieldExtraDieOn = $state<'activated' | 'other'>('activated');

	const spendsCharges = isResourceSpendingAutomationEnabled();
	const fixedChargeCosts = spendsCharges ? fixedChargeCostsOf(actor, item) : [];
	const held = heldChangeChoice(actor, item, options.ignoresDisadvantage, {
		get: () => selectedRollMode,
		set: (mode) => {
			selectedRollMode = mode;
		},
	});
	const keptAmount = keptAmountFor(actor, item);
	let usesKeptAmount = $state(keptAmount !== null && !held.choosing);
	let usesDamageMultiplier = $state(false);
	let formulaChoiceChecked = $state<Record<string, boolean>>({});

	function setFormulaChoice(key: string, checked: boolean) {
		formulaChoiceChecked = { ...formulaChoiceChecked, [key]: checked };
	}

	const weaponAttack = weaponAttackOf(item);
	const weapons = weaponOptionsFor(actor, weaponAttack);
	const weaponGroups = groupWeapons(weapons);
	let weaponUuid = $state<string | null>(weapons[0]?.uuid ?? null);
	const chosenWeapon = $derived(weapons.find((weapon) => weapon.uuid === weaponUuid) ?? null);
	const halfRange = halfRangeOf(item);
	const rangeLine = $derived(
		chosenWeapon
			? halfRangeText({
					halfRange,
					targets: {
						attackType: chosenWeapon.attackType,
						distance: attackDistanceWith(chosenWeapon, halfRange),
					},
				})
			: '',
	);
	const weaponItemOf = (uuid: string | null | undefined) =>
		uuid
			? (Array.from((actor.items ?? []) as Iterable<{ uuid?: string; identifier?: string }>).find(
					(each) => each.uuid === uuid,
				) ?? null)
			: null;
	const damageMultiplier = $derived(
		damageMultiplierOf(item) ?? damageMultiplierOf(weaponItemOf(weaponUuid)),
	);

	// A weapon ability attacks as the weapon does, so the weapon's attack type
	// decides melee or ranged.
	const itemSystem = item.system as {
		activation?: Parameters<typeof attackConditionLines>[1];
		properties?: { selected?: string[] };
	};
	const activationWith = (weapon: { attackType: string } | null) =>
		weapon
			? {
					...itemSystem.activation,
					targets: { ...itemSystem.activation?.targets, attackType: weapon.attackType },
				}
			: itemSystem.activation;
	const heldItemWith = (weapon: { attackType: string } | null) =>
		({ system: { activation: activationWith(weapon) } }) as Parameters<typeof held.reread>[0];
	if (weapons[0]) held.reread(heldItemWith(weapons[0]));

	const attackDelivery: AttackDelivery = $derived(
		deliveryOfAttack(activationWith(chosenWeapon) as AttackActivation | undefined, actor),
	);
	const autoBonusPools: SpendablePool[] = $derived(
		allRolledPools.filter(
			(pool) =>
				pool.consumption === 'autoBonus' &&
				matchesAttackDelivery(pool.bonusOnAttackDelivery, attackDelivery),
		),
	);
	const autoBonusSummaries: AutoBonusSummary[] = $derived(buildAutoBonusSummaries(autoBonusPools));
	const autoBonusFormula: string = $derived(buildAutoBonusFormula(autoBonusPools));

	const conditionLinesFor = (weapon: { attackType: string } | null) =>
		attackConditionLines(
			actor,
			activationWith(weapon),
			firstTargetActor ?? null,
			itemSystem.properties?.selected,
		);
	const initialConditionLines = conditionLinesFor(weapons[0] ?? null);
	let conditionLines = $state(initialConditionLines);

	// Conditional bonuses offer a per-attack choice between advantage and bonus damage.
	// Snapshot what applies against the target at dialog-open time; with two or more
	// targets, a bonus that tests the target is not offered. If the player retargets while
	// the dialog is open, the choice is not checked again at submit.
	// One spend of a pool per attack: a bonus does not spend from a pool the use already spends from.
	const poolsSpentByUse = new Set(fixedChargeCosts.map((cost) => cost.poolId));
	const conditionalBonusesFor = (weapon: WeaponOption | null) =>
		getActiveConditionalBonuses(
			actor as unknown as { rules?: unknown[]; getFlag(scope: string, key: string): unknown },
			{
				type: item.type,
				identifier: (item as { identifier?: string }).identifier,
				system: { activation: activationWith(weapon) as { targets?: { attackType?: string } } },
			},
			firstTargetActor,
			weaponItemOf(weapon?.uuid),
			options.attackOrigin,
		).filter((option) => !option.charge || !poolsSpentByUse.has(option.charge.poolId));
	const initialConditionalBonusOptions = conditionalBonusesFor(weapons[0] ?? null);
	let conditionalBonusOptions = $state<ConditionalBonusOption[]>(initialConditionalBonusOptions);
	const conditionOptions = $derived(conditionRollModeOptions(conditionLines));
	const opened = openRollModeTicks(
		initialRollMode,
		conditionRollModeOptions(initialConditionLines),
	);
	let selectedRollMode = $state(opened.mode);
	let appliedTicks = $state<AppliedTicks>(opened.applied);

	// The condition ticks and conditional bonuses of the new weapon replace those of the old one.
	function chooseWeapon(uuid: string | null) {
		weaponUuid = uuid;
		const weapon = weapons.find((each) => each.uuid === uuid) ?? null;
		held.reread(heldItemWith(weapon));
		const own = selectedRollMode - Object.values(appliedTicks).reduce((sum, step) => sum + step, 0);
		conditionLines = conditionLinesFor(weapon);
		const reopened = openRollModeTicks(own, conditionRollModeOptions(conditionLines));
		selectedRollMode = reopened.mode;
		appliedTicks = reopened.applied;
		conditionalBonusOptions = conditionalBonusesFor(weapon);
		conditionalChoices = Object.fromEntries(
			conditionalBonusOptions.map((o) => [
				o.key,
				conditionalChoices[o.key] ?? defaultConditionalChoice(o),
			]),
		);
	}
	let conditionalChoices = $state<Record<string, ConditionalChoice>>(
		Object.fromEntries(
			initialConditionalBonusOptions.map((o) => [o.key, defaultConditionalChoice(o)]),
		),
	);
	let situationalModifiers = $state('');
	let primaryDieValue = $state<number | null | undefined>();
	let primaryDieModifier = $state<number | null | undefined>();
	let shouldRollBeHidden = $state(hideRollsDefault);

	// Selected rolled-pool dice, keyed as `${poolId}:${faceIndex}`.
	let selectedDieKeys = $state(new Set<string>());

	// Per-charge-pool count of charges the player has chosen to spend.
	let chargeSpendCounts = $state<Record<string, number>>(
		Object.fromEntries(chargePoolsWithDie.map((p) => [p.id, 0])),
	);

	// Variable spends open at their minimum rather than at 0: the activation is
	// gated on being able to pay the minimum, so 0 is not a legal amount.
	let variableSpendCounts = $state<Record<string, number>>(
		Object.fromEntries(variableChargeSpends.map((spend) => [spend.poolId, spend.minimum])),
	);

	function toggleDie(poolId: string, faceIndex: number) {
		const key = `${poolId}:${faceIndex}`;
		if (selectedDieKeys.has(key)) {
			selectedDieKeys.delete(key);
		} else {
			selectedDieKeys.add(key);
		}
		selectedDieKeys = new Set(selectedDieKeys);
	}

	function isDieSelected(poolId: string, faceIndex: number): boolean {
		return selectedDieKeys.has(`${poolId}:${faceIndex}`);
	}

	function setVariableSpend(poolId: string, value: number) {
		const spend = variableChargeSpends.find((candidate) => candidate.poolId === poolId);
		if (!spend) return;
		const next = Number.isFinite(value) ? Math.floor(value) : spend.minimum;
		variableSpendCounts = {
			...variableSpendCounts,
			[poolId]: Math.clamp(next, spend.minimum, spend.limit),
		};
	}

	function adjustVariableSpend(poolId: string, delta: number) {
		const spend = variableChargeSpends.find((candidate) => candidate.poolId === poolId);
		if (!spend) return;
		setVariableSpend(poolId, (variableSpendCounts[poolId] ?? spend.minimum) + delta);
	}

	function adjustChargeSpend(poolId: string, delta: number) {
		const pool = offeredChargePools.find((p) => p.id === poolId);
		if (!pool) return;
		const next = Math.max(0, Math.min(pool.current, (chargeSpendCounts[poolId] ?? 0) + delta));
		chargeSpendCounts = { ...chargeSpendCounts, [poolId]: next };
	}

	const poolBonusEntries = $derived.by<PoolBonusEntry[]>(() => {
		const entries: PoolBonusEntry[] = [];
		for (const key of selectedDieKeys) {
			const [poolId, indexStr] = key.split(':');
			const pool = spendablePools.find((p) => p.id === poolId);
			if (!pool) continue;
			const face = pool.faces[Number(indexStr)];
			if (typeof face !== 'number') continue;
			entries.push({ face, label: pool.label });
		}
		return entries;
	});

	const poolBonus = $derived(poolBonusEntries.reduce((sum, e) => sum + e.face, 0));

	// Charge-pool spends produce dice expressions, not flat bonuses. Aggregate
	// per pool: "+2d6[Combat Dice]" rather than two separate "+1d6" terms.
	const chargeBonusFragments = $derived.by<ChargeBonusFragment[]>(() => {
		const fragments: ChargeBonusFragment[] = [];
		for (const pool of offeredChargePools) {
			const count = chargeSpendCounts[pool.id] ?? 0;
			if (count < 1) continue;
			fragments.push({
				formula: `+${count}${pool.dieSize}[${pool.label}]`,
				display: `+${count}${pool.dieSize}`,
				label: pool.label,
			});
		}
		return fragments;
	});

	// Foundry parses `[label]` into term.options.flavor so the roll tooltip
	// credits each face/die to its source pool. Combines: manual selections +
	// auto-bonus pools + charges.
	const poolBonusFormula = $derived(
		poolBonusEntries.map((e) => `+${e.face}[${e.label}]`).join('') +
			autoBonusFormula +
			chargeBonusFragments.map((f) => f.formula).join(''),
	);

	// The variable spends in the shape the manager deducts from.
	const consumedVariableCharges = $derived(
		variableChargeSpends
			.map((spend) => ({ poolId: spend.poolId, count: variableSpendCounts[spend.poolId] ?? 0 }))
			.filter((entry) => entry.count > 0),
	);

	// `key` is the composite `${itemUuid}:${ruleId}` from getActiveConditionalBonuses,
	// not a bare rule id — rule ids are only unique within an item.
	function setConditionalChoice(key: string, choice: ConditionalChoice) {
		conditionalChoices = { ...conditionalChoices, [key]: choice };
	}

	// A chosen bonus that spends a charge takes one when the roll is made.
	const chosenCharges = $derived(
		conditionalBonusOptions
			.filter((o) => o.charge && (conditionalChoices[o.key] ?? 'none') !== 'none')
			.map((o) => o.charge as NonNullable<ConditionalBonusOption['charge']>),
	);
	// One spend of a pool per attack: the stepper and a chosen bonus never both spend from one pool.
	const offeredChargePools = $derived(
		chargePoolsWithDie.filter(
			(pool) =>
				!poolsSpentByUse.has(pool.id) && !chosenCharges.some((charge) => charge.poolId === pool.id),
		),
	);
	const offeredChargeSpends = $derived(
		offeredChargePools
			.map((pool) => ({ poolId: pool.id, count: chargeSpendCounts[pool.id] ?? 0 }))
			.filter((entry) => entry.count > 0),
	);
	const shownBonusOptions = $derived(
		conditionalBonusOptions.filter(
			(option) =>
				!option.charge ||
				!offeredChargeSpends.some((spend) => spend.poolId === option.charge?.poolId),
		),
	);
	const hasConditionalBonuses = $derived(shownBonusOptions.length > 0);
	const hasSpendablePools = $derived(
		spendablePools.length > 0 || offeredChargePools.length > 0 || autoBonusPools.length > 0,
	);
	const chargeCosts = $derived([
		...fixedChargeCosts,
		...(spendsCharges ? chosenCharges : [])
			.filter((charge) => !charge.hidden)
			.map((charge) => ({ label: charge.label, amount: 1, current: charge.current })),
	]);
	// One line for every cost of the roll, charges with what is left after the roll.
	const spendLine = $derived.by(() => {
		const costParts = rollWindowCostParts([...resources.chosen(), ...splits.costs()]);
		const charges = chargeCosts.map((cost) =>
			localize('NIMBLE.rollWindow.spendCharge', {
				count: String(cost.amount),
				pool: cost.label,
				left: String(Math.max(0, cost.current - cost.amount)),
			}),
		);
		return rollSpendLine(
			options.spendsActions,
			[...costParts.spends, ...charges],
			costParts.sacrifices,
		);
	});
	const consumedChargePools = $derived([
		...offeredChargeSpends,
		...chosenCharges.map((charge) => ({ poolId: charge.poolId, count: 1 })),
	]);

	// Net advantage stacks contributed by choices set to "advantage".
	const conditionalAdvantageTotal = $derived(
		conditionalBonusOptions.reduce(
			(sum, o) => (conditionalChoices[o.key] === 'advantage' ? sum + o.advantage : sum),
			0,
		),
	);

	const conditionRollModes = $derived(tickedConditionRollModes(conditionLines, appliedTicks));
	const ownRollMode = $derived(rollModeWithoutConditions(selectedRollMode, conditionRollModes));

	// The roll mode the manager gets: the player's own, with the condition ticks
	// and the ticked Held Changes apart (they go in as their own sources) and the
	// advantage choices in.
	const submittedRollMode = $derived(
		Math.clamp(
			ownRollMode - held.rollMode + conditionalAdvantageTotal,
			-MAX_ROLL_MODE,
			MAX_ROLL_MODE,
		),
	);

	const chosenDamageOptions = $derived(
		conditionalBonusOptions.filter((o) => conditionalChoices[o.key] === 'damage'),
	);

	// Untyped damage choices fold into the primary damage roll (inheriting the
	// weapon/spell's own damage type) — the common case, e.g. Hunter's +LVL.
	// Credited to their source via `[label]` flavor.
	const conditionalDamageFormula = $derived(
		chosenDamageOptions
			.filter((o) => o.damageType === '' && !o.fromItemIdentifier)
			.map((o) => {
				const term = o.damageFormula ?? `${o.damageValue ?? 0}`;
				return `+${term}[${o.label}]`;
			})
			.join(''),
	);

	// Choices whose rule specifies a damage type are emitted as their own typed
	// damage effects (see the manager's #getRolls) so the chosen type actually
	// applies instead of being absorbed into the primary roll's type. The damage of
	// an item is its own step too, so its dice can be read on the card.
	const conditionalTypedDamages = $derived(
		chosenDamageOptions
			.filter((o) => o.damageType !== '' || !!o.fromItemIdentifier)
			.map((o) => ({
				formula: o.damageFormula ?? `${o.damageValue ?? 0}`,
				damageType: o.damageType,
				label: o.label,
				...(o.itemUuid ? { itemUuid: o.itemUuid } : {}),
				...(o.fromItemIdentifier ? { fromItemIdentifier: o.fromItemIdentifier } : {}),
			})),
	);

	const baseDamageEffects = $derived.by(() => {
		const effects = extractDamageEffectsFromItem(options.item());
		if (!chosenWeapon || !effects[0]) return effects;
		const [first, ...others] = effects;
		return [
			{ ...first, formula: chosenWeapon.formula, damageType: chosenWeapon.damageType },
			...others,
		];
	});
	const formulaChoices = $derived(
		damageFormulaChoiceOffers(
			actor,
			(chosenWeapon ? weaponItemOf(weaponUuid) : (item as { identifier?: string }))?.identifier ??
				'',
			baseDamageEffects[0]?.formula ?? '',
		),
	);
	const damageEffects = $derived.by(() => {
		const effects = baseDamageEffects;
		const first = effects[0];
		if (!first) return effects;
		const replaced = applyDamageFormulaChoices(first.formula, formulaChoices, formulaChoiceChecked);
		if (replaced === null) return effects;
		const [head, ...rest] = effects;
		return [{ ...head, formula: replaced }, ...rest];
	});

	const damageFormula = $derived(damageEffects[0]?.formula || '0');

	// Pool dice are appended as a flat bonus to the FIRST damage roll only —
	// matches "Add a Fury Die to every STR attack" (one attack = one damage roll).
	const modifiedFormulas = $derived.by(() =>
		damageEffects.map((effect, index) => {
			let formula = effect.formula;
			if (situationalModifiers !== '') {
				formula += `+${situationalModifiers}`;
			}
			if (index === 0 && poolBonusFormula) {
				formula += poolBonusFormula;
			}
			if (index === 0 && conditionalDamageFormula) {
				formula += conditionalDamageFormula;
			}
			return {
				formula,
				damageType: effect.damageType,
			};
		}),
	);

	// Preview rows for the dialog: the item's (modified) damage effects plus a
	// row per typed conditional damage, so the player sees the chosen typed
	// bonus that #getRolls will roll as its own effect.
	const damagePreviews = $derived(
		keptAmount && usesKeptAmount
			? [{ formula: String(keptAmount.value), damageType: damageEffects[0]?.damageType }]
			: [
					...modifiedFormulas,
					...conditionalTypedDamages.map((d) => ({ formula: d.formula, damageType: d.damageType })),
				],
	);

	return {
		// Form fields (read/write through getter/setter so Svelte tracks writes).
		get selectedRollMode() {
			return selectedRollMode;
		},
		set selectedRollMode(value: number) {
			selectedRollMode = value;
		},
		get conditionOptions() {
			return conditionOptions;
		},
		get ownRollMode() {
			return ownRollMode;
		},
		get appliedTicks() {
			return appliedTicks;
		},
		set appliedTicks(value: AppliedTicks) {
			appliedTicks = value;
		},
		get conditionRollModes() {
			return conditionRollModes;
		},
		get submittedRollMode() {
			return submittedRollMode;
		},
		get situationalModifiers() {
			return situationalModifiers;
		},
		set situationalModifiers(value: string) {
			situationalModifiers = value;
		},
		get primaryDieValue() {
			return primaryDieValue;
		},
		set primaryDieValue(value: number | null | undefined) {
			primaryDieValue = value;
		},
		get primaryDieModifier() {
			return primaryDieModifier;
		},
		set primaryDieModifier(value: number | null | undefined) {
			primaryDieModifier = value;
		},
		get shouldRollBeHidden() {
			return shouldRollBeHidden;
		},
		set shouldRollBeHidden(value: boolean) {
			shouldRollBeHidden = value;
		},

		get maxDamageChoice() {
			return maxDamageChoice;
		},
		set maxDamageChoice(value: MaxDamageChoice | null) {
			maxDamageChoice = value;
		},
		weapons,
		weaponGroups,
		needsWeapon: weaponAttack !== '',
		get weaponUuid() {
			return weaponUuid;
		},
		set weaponUuid(value: string | null) {
			chooseWeapon(value);
		},
		get rangeLine() {
			return rangeLine;
		},
		get chargeCosts() {
			return chargeCosts;
		},
		get cannotRollReason() {
			if (weaponAttack !== '' && !chosenWeapon) return localize('NIMBLE.rollWindow.noWeapon');
			const unpaid = chargeCosts.find((cost) => cost.current < cost.amount);
			return unpaid ? localize('NIMBLE.rollWindow.noCharge', { pool: unpaid.label }) : '';
		},
		keptAmount,
		get heldLines() {
			return held.lines;
		},
		choosesHeldChanges: held.choosing,
		get chosenHeldChanges() {
			return held.chosen;
		},
		set chosenHeldChanges(value: string[]) {
			held.chosen = value;
		},
		get damageMultiplier() {
			return damageMultiplier;
		},
		get usesDamageMultiplier() {
			return usesDamageMultiplier;
		},
		set usesDamageMultiplier(value: boolean) {
			usesDamageMultiplier = value;
		},
		get formulaChoices() {
			return formulaChoices;
		},
		get formulaChoiceChecked() {
			return formulaChoiceChecked;
		},
		setFormulaChoice,
		get usesKeptAmount() {
			return usesKeptAmount;
		},
		set usesKeptAmount(value: boolean) {
			usesKeptAmount = value;
		},
		maxDamageOffers: maxDamage,
		get spendLine() {
			return spendLine;
		},
		get variableResourceCosts() {
			return resources.variableCosts;
		},
		get resourceAmounts() {
			return resources.amounts;
		},
		setResourceAmount: resources.set,
		adjustResourceAmount: resources.adjust,
		get optionSplits() {
			return splits.views;
		},
		/** The Spell or Attack Options the player turned on. */
		get useOptions() {
			return splits.chosen;
		},
		setPick: splits.set,
		adjustPick: splits.adjust,
		offersLessMana,
		dualWieldOffer,
		get dualWield() {
			return dualWield;
		},
		// With the same formula, the tick is advantage in the Roll Mode field.
		set dualWield(value: boolean) {
			if (dualWieldOffer && !dualWieldOffer.other && value !== dualWield) {
				selectedRollMode = Math.clamp(selectedRollMode + (value ? 1 : -1), -6, 6);
			}
			dualWield = value;
		},
		get dualWieldExtraDieOn() {
			return dualWieldExtraDieOn;
		},
		set dualWieldExtraDieOn(value: 'activated' | 'other') {
			dualWieldExtraDieOn = value;
		},
		get lessMana() {
			return lessMana;
		},
		set lessMana(value: boolean) {
			lessMana = value;
		},
		offersFreeUse,
		get freeUse() {
			return freeUse;
		},
		set freeUse(value: boolean) {
			freeUse = value;
		},

		// Pool snapshots (immutable).
		spendablePools,
		variableChargeSpends,
		get spendableChargePools() {
			return offeredChargePools;
		},
		get autoBonusSummaries() {
			return autoBonusSummaries;
		},
		get conditionalBonusOptions() {
			return shownBonusOptions;
		},

		// Conditional-bonus choices.
		get conditionalChoices() {
			return conditionalChoices;
		},
		get hasConditionalBonuses() {
			return hasConditionalBonuses;
		},
		get conditionalAdvantageTotal() {
			return conditionalAdvantageTotal;
		},
		setConditionalChoice,
		conditionalBonusTick,

		// Selection getters.
		get chargeSpendCounts() {
			return chargeSpendCounts;
		},
		/** The charges the roll spends: the ones the player added, and those of chosen bonuses. */
		get consumedChargePools() {
			return consumedChargePools;
		},
		get variableSpendCounts() {
			return variableSpendCounts;
		},
		get consumedVariableCharges() {
			return consumedVariableCharges;
		},
		get selectedDieKeys() {
			return selectedDieKeys;
		},

		// Derived values.
		get poolBonus() {
			return poolBonus;
		},
		get chargeBonusFragments() {
			return chargeBonusFragments;
		},
		get hasSpendablePools() {
			return hasSpendablePools;
		},
		get damageFormula() {
			return damageFormula;
		},
		get modifiedFormulas() {
			return modifiedFormulas;
		},
		get damagePreviews() {
			return damagePreviews;
		},
		get conditionalTypedDamages() {
			return conditionalTypedDamages;
		},

		// Actions.
		toggleDie,
		isDieSelected,
		adjustChargeSpend,
		adjustVariableSpend,
		setVariableSpend,
	};
}
