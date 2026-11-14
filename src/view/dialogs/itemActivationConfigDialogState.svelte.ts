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
import {
	type ConditionalBonusOption,
	getActiveConditionalBonuses,
} from '#utils/actor/conditionalBonuses.js';
import { offersLessManaFor } from '#utils/chaos/lessMana.js';
import { fixedChargeCostsOf } from '#utils/chargePool/fixedChargeCosts.js';
import { itemOffersFreeUse } from '#utils/chargePool/helpers.js';
import { matchesAttackDelivery } from '#utils/damage/attackDelivery.js';
import { damageMultiplierOf } from '#utils/damage/damageMultiplier.js';
import { dualWieldOfferFor } from '#utils/damage/dualWield.js';
import { maxDamageOffers } from '#utils/damage/maxDamageOffers.js';
import { weaponAttackOf, weaponOptionsFor } from '#utils/damage/weaponAttack.js';
import { heldLinesForItem, keptAmountFor } from '#utils/heldChange/heldChange.js';
import localize from '#utils/localize.js';
import {
	rollModeWithoutConditions,
	tickedConditionRollModes,
} from '#utils/rolls/appliedConditionRollModes.js';
import { attackConditionLines } from '#utils/rolls/attackConditionLines.js';
import { MAX_ROLL_MODE, openRollModeTicks, tickChosen } from '#utils/rolls/rollModeTicks.js';
import { soleTarget } from '#utils/tokens/soleTarget.js';
import {
	isResourceSpendingAutomationEnabled,
	isRuleAutomationEnabled,
} from '../../settings/automationSettings.js';
import { conditionRollModeOptions } from './components/conditionRollModeOptions.ts';
import {
	buildAutoBonusFormula,
	buildAutoBonusSummaries,
	extractDamageEffectsFromItem,
	extractRolledPools,
	extractSpendableChargePools,
	extractVariableChargeSpends,
	getAttackDeliveryFromActivation,
} from './itemActivationConfigDialogHelpers.js';

type ConditionalChoice = 'advantage' | 'damage' | 'none';

export interface CreateItemActivationConfigDialogStateOptions {
	actor: () => Actor;
	item: () => Item;
	initialRollMode?: number;
	hideRollsDefault: boolean;
	/** The roll ignores disadvantage already, so the change that ignores it has no line. */
	ignoresDisadvantage?: boolean;
}

export function createItemActivationConfigDialogState(
	options: CreateItemActivationConfigDialogStateOptions,
) {
	const { initialRollMode = 0, hideRollsDefault } = options;

	// Snapshot actor and item at dialog-open time — pools reflect what is
	// available when the player initiates the roll, not mid-dialog changes.
	const actor = options.actor();
	const item = options.item();

	const attackDelivery: AttackDelivery = getAttackDeliveryFromActivation(item);

	const allRolledPools = extractRolledPools(actor);
	const spendablePools: SpendablePool[] = allRolledPools.filter(
		(pool) => pool.consumption !== 'autoBonus',
	);
	const autoBonusPools: SpendablePool[] = allRolledPools.filter(
		(pool) =>
			pool.consumption === 'autoBonus' &&
			matchesAttackDelivery(pool.bonusOnAttackDelivery, attackDelivery),
	);
	const spendableChargePools: SpendableChargePool[] = extractSpendableChargePools(actor);
	const variableChargeSpends: VariableChargeSpend[] = extractVariableChargeSpends(actor, item);
	const autoBonusSummaries: AutoBonusSummary[] = buildAutoBonusSummaries(autoBonusPools);
	const autoBonusFormula: string = buildAutoBonusFormula(autoBonusPools);

	// Conditional bonuses (e.g. Hunter's quarry) offer a per-attack choice between
	// advantage and bonus damage. Snapshot what applies against the target at
	// dialog-open time; with two or more targets, a bonus that tests the target is
	// not offered. If the player retargets while the dialog is open, the choice is
	// not checked again at submit.
	const firstTargetActor = (
		soleTarget(game.user?.targets, {
			firstDecides:
				(item.system as { activation?: { targets?: { singleTargetAttack?: boolean } } }).activation
					?.targets?.singleTargetAttack === true,
		}) as Token | null
	)?.actor as { uuid?: string; getTargetDomain?: () => Set<string> } | undefined;
	const conditionalBonusOptions: ConditionalBonusOption[] = getActiveConditionalBonuses(
		actor as unknown as { rules?: unknown[]; getFlag(scope: string, key: string): unknown },
		item as unknown as {
			type?: string;
			system?: { activation?: { targets?: { attackType?: string } } };
		},
		firstTargetActor,
	);
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

	const chargeCosts = isResourceSpendingAutomationEnabled() ? fixedChargeCostsOf(actor, item) : [];
	// With Feature Effects off the player ticks each Held Change; none starts ticked.
	const choosesHeldChanges = !isRuleAutomationEnabled();
	const heldLines = heldLinesForItem(actor, item, {
		ignoresDisadvantage: options.ignoresDisadvantage,
		choosing: choosesHeldChanges,
	});
	let chosenHeldChanges = $state<string[]>([]);
	// A ticked change that gives advantage or disadvantage moves the slider; the roll adds it.
	const heldRollModeTicks = heldLines.flatMap((line) =>
		line.rollMode ? [{ key: line.key, value: line.rollMode }] : [],
	);
	let heldTicks = $state<AppliedTicks>({});
	function chooseHeldChanges(keys: string[]) {
		const moved = tickChosen(selectedRollMode, heldTicks, heldRollModeTicks, keys);
		selectedRollMode = moved.mode;
		heldTicks = moved.applied;
		chosenHeldChanges = keys;
	}
	const keptAmount = keptAmountFor(actor, item);
	let usesKeptAmount = $state(keptAmount !== null && !choosesHeldChanges);
	const damageMultiplier = damageMultiplierOf(item);
	let usesDamageMultiplier = $state(false);

	const weaponAttack = weaponAttackOf(item);
	const weapons = weaponOptionsFor(actor, weaponAttack);
	let weaponUuid = $state<string | null>(weapons[0]?.uuid ?? null);
	const chosenWeapon = $derived(weapons.find((weapon) => weapon.uuid === weaponUuid) ?? null);

	// A weapon ability attacks as the weapon does, so the weapon's attack type
	// decides melee or ranged.
	const itemSystem = item.system as {
		activation?: Parameters<typeof attackConditionLines>[1];
		properties?: { selected?: string[] };
	};
	const conditionLinesFor = (weapon: { attackType: string } | null) =>
		attackConditionLines(
			actor,
			weapon
				? {
						...itemSystem.activation,
						targets: { ...itemSystem.activation?.targets, attackType: weapon.attackType },
					}
				: itemSystem.activation,
			firstTargetActor ?? null,
			itemSystem.properties?.selected,
		);
	let conditionLines = $state(conditionLinesFor(weapons[0] ?? null));
	const conditionOptions = $derived(conditionRollModeOptions(conditionLines));
	const opened = openRollModeTicks(initialRollMode, conditionRollModeOptions(conditionLines));
	let selectedRollMode = $state(opened.mode);
	let appliedTicks = $state<AppliedTicks>(opened.applied);

	// The condition ticks of the new weapon replace those of the old one.
	function chooseWeapon(uuid: string | null) {
		weaponUuid = uuid;
		const own = selectedRollMode - Object.values(appliedTicks).reduce((sum, step) => sum + step, 0);
		conditionLines = conditionLinesFor(weapons.find((weapon) => weapon.uuid === uuid) ?? null);
		const reopened = openRollModeTicks(own, conditionRollModeOptions(conditionLines));
		selectedRollMode = reopened.mode;
		appliedTicks = reopened.applied;
	}
	let conditionalChoices = $state<Record<string, ConditionalChoice>>(
		Object.fromEntries(conditionalBonusOptions.map((o) => [o.key, defaultConditionalChoice(o)])),
	);
	let situationalModifiers = $state('');
	let primaryDieValue = $state<number | null | undefined>();
	let primaryDieModifier = $state<number | null | undefined>();
	let shouldRollBeHidden = $state(hideRollsDefault);

	// Selected rolled-pool dice, keyed as `${poolId}:${faceIndex}`.
	let selectedDieKeys = $state(new Set<string>());

	// Per-charge-pool count of charges the player has chosen to spend.
	let chargeSpendCounts = $state<Record<string, number>>(
		Object.fromEntries(spendableChargePools.map((p) => [p.id, 0])),
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
		const pool = spendableChargePools.find((p) => p.id === poolId);
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
		for (const pool of spendableChargePools) {
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

	const hasSpendablePools = $derived(
		spendablePools.length > 0 || spendableChargePools.length > 0 || autoBonusPools.length > 0,
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

	const hasConditionalBonuses = $derived(conditionalBonusOptions.length > 0);

	// Net advantage stacks contributed by choices set to "advantage".
	const conditionalAdvantageTotal = $derived(
		conditionalBonusOptions.reduce(
			(sum, o) => (conditionalChoices[o.key] === 'advantage' ? sum + o.advantage : sum),
			0,
		),
	);

	const conditionRollModes = $derived(tickedConditionRollModes(conditionLines, appliedTicks));
	const ownRollMode = $derived(rollModeWithoutConditions(selectedRollMode, conditionRollModes));

	const heldRollMode = $derived(Object.values(heldTicks).reduce((sum, step) => sum + step, 0));

	// The roll mode the manager gets: the player's own, with the condition ticks
	// and the ticked Held Changes apart (they go in as their own sources) and the
	// advantage choices in.
	const submittedRollMode = $derived(
		Math.clamp(
			ownRollMode - heldRollMode + conditionalAdvantageTotal,
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
				...(o.fromItemIdentifier ? { fromItemIdentifier: o.fromItemIdentifier } : {}),
			})),
	);

	const damageEffects = $derived.by(() => {
		const effects = extractDamageEffectsFromItem(options.item());
		if (!chosenWeapon || !effects[0]) return effects;
		const [first, ...others] = effects;
		return [
			{ ...first, formula: chosenWeapon.formula, damageType: chosenWeapon.damageType },
			...others,
		];
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
		needsWeapon: weaponAttack !== '',
		get weaponUuid() {
			return weaponUuid;
		},
		set weaponUuid(value: string | null) {
			chooseWeapon(value);
		},
		chargeCosts,
		get cannotRollReason() {
			if (weaponAttack !== '' && !chosenWeapon) return localize('NIMBLE.rollWindow.noWeapon');
			const unpaid = chargeCosts.find((cost) => cost.current < cost.amount);
			return unpaid ? localize('NIMBLE.rollWindow.noCharge', { pool: unpaid.label }) : '';
		},
		keptAmount,
		heldLines,
		choosesHeldChanges,
		get chosenHeldChanges() {
			return chosenHeldChanges;
		},
		set chosenHeldChanges(value: string[]) {
			chooseHeldChanges(value);
		},
		damageMultiplier,
		get usesDamageMultiplier() {
			return usesDamageMultiplier;
		},
		set usesDamageMultiplier(value: boolean) {
			usesDamageMultiplier = value;
		},
		get usesKeptAmount() {
			return usesKeptAmount;
		},
		set usesKeptAmount(value: boolean) {
			usesKeptAmount = value;
		},
		maxDamageOffers: maxDamage,
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
		spendableChargePools,
		variableChargeSpends,
		autoBonusSummaries,
		conditionalBonusOptions,

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

		// Selection getters.
		get chargeSpendCounts() {
			return chargeSpendCounts;
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
