import type {
	AttackDelivery,
	AutoBonusSummary,
	ChargeBonusFragment,
	PoolBonusEntry,
	SpendableChargePool,
	SpendablePool,
} from '#types/components/ItemActivationConfigDialog.d.ts';
import {
	buildAutoBonusFormula,
	buildAutoBonusSummaries,
	extractDamageEffectsFromItem,
	extractRolledPools,
	extractSpendableChargePools,
	getAttackDeliveryFromActivation,
	matchesAttackDelivery,
} from './itemActivationConfigDialogHelpers.js';

export interface CreateItemActivationConfigDialogStateOptions {
	actor: Actor;
	item: Item;
	initialRollMode?: number;
	hideRollsDefault: boolean;
}

export function createItemActivationConfigDialogState(
	options: CreateItemActivationConfigDialogStateOptions,
) {
	const { actor, item, initialRollMode = 0, hideRollsDefault } = options;

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
	const autoBonusSummaries: AutoBonusSummary[] = buildAutoBonusSummaries(autoBonusPools);
	const autoBonusFormula: string = buildAutoBonusFormula(autoBonusPools);

	let selectedRollMode = $state(Math.clamp(initialRollMode, -6, 6));
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

	const damageEffects = $derived.by(() => extractDamageEffectsFromItem(item));

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
			return {
				formula,
				damageType: effect.damageType,
			};
		}),
	);

	return {
		// Form fields (read/write through getter/setter so Svelte tracks writes).
		get selectedRollMode() {
			return selectedRollMode;
		},
		set selectedRollMode(value: number) {
			selectedRollMode = value;
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

		// Pool snapshots (immutable).
		spendablePools,
		spendableChargePools,
		autoBonusSummaries,

		// Selection getters.
		get chargeSpendCounts() {
			return chargeSpendCounts;
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

		// Actions.
		toggleDie,
		isDieSelected,
		adjustChargeSpend,
	};
}
