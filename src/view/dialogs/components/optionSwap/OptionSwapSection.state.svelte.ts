import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SelectionGroup } from '#types/components/ClassFeatureSelection.d.ts';
import type { ResolvedOptionSwapOffer } from '#types/optionSwap.d.ts';
import localize from '#utils/localize.js';

/** The highest bonus a skill can ever have, per the core rules. */
const MAX_SKILL_MODIFIER = 12;

export interface OptionSwapSkillData {
	points: number;
	mod: number;
}

export interface OptionSwapSkillRow {
	key: string;
	name: string;
	/** Point total the character would hold after the pending move. */
	points: number;
	/** Modifier the character would roll with after the pending move. */
	mod: number;
	change: number;
	canAdd: boolean;
	canSubtract: boolean;
	addTooltip: string;
	subtractTooltip: string;
}

interface OptionSwapSectionStateProps {
	offer: ResolvedOptionSwapOffer | null;
	skills: Record<string, OptionSwapSkillData>;
}

/**
 * Creates reactive state for the OptionSwapSection component.
 *
 * The picks start on what the character already holds, so the section opens showing the sheet
 * as it stands and every change the player makes is a deliberate one. Skill points move rather
 * than accrue: a point can only be added to a skill once one has been taken from another, which
 * keeps the total the character earned by levelling untouched.
 */
export function createOptionSwapSectionState(getProps: () => OptionSwapSectionStateProps) {
	let isExpanded = $state(false);
	let selectedByPool = $state<Map<string, NimbleFeatureItem[]>>(new Map());
	let skillChanges = $state<Record<string, number>>({});

	const pools = $derived(getProps().offer?.pools ?? []);
	const skillBudget = $derived(getProps().offer?.skillPoints ?? 0);
	const requiredActs = $derived(getProps().offer?.requiredActs ?? []);
	const hasOffer = $derived(pools.length > 0 || skillBudget > 0);

	const groups = $derived(
		pools.map((pool) => ({
			pool,
			group: {
				features: pool.candidates,
				selectionCount: pool.pickCount,
				...(pool.displayName ? { displayName: pool.displayName } : {}),
			} satisfies SelectionGroup,
		})),
	);

	const pointsTaken = $derived(
		Object.values(skillChanges).reduce((total, change) => (change < 0 ? total - change : total), 0),
	);
	const pointsPlaced = $derived(
		Object.values(skillChanges).reduce((total, change) => (change > 0 ? total + change : total), 0),
	);
	const hasUnplacedPoint = $derived(pointsPlaced < pointsTaken);

	const skillRows = $derived.by(() => {
		const skillNames = CONFIG.NIMBLE.skills as Record<string, string>;

		return Object.entries(getProps().skills)
			.map(([key, skill]) => {
				const change = skillChanges[key] ?? 0;
				return {
					key,
					name: skillNames[key] ?? key,
					points: skill.points + change,
					mod: skill.mod + change,
					change,
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((row) => ({
				...row,
				canAdd: canAddPoint(row),
				canSubtract: canSubtractPoint(row),
				addTooltip: getAddTooltip(row),
				subtractTooltip: getSubtractTooltip(row),
			})) satisfies OptionSwapSkillRow[];
	});

	/** Pool key to chosen uuids, the shape `planOptionSwap` reads. */
	const selectionUuids = $derived.by(() => {
		const result = new Map<string, string[]>();
		for (const pool of pools) {
			const selected = selectedByPool.get(pool.poolKey);
			if (!selected) continue;
			result.set(
				pool.poolKey,
				selected.map((feature) => feature.uuid ?? ''),
			);
		}
		return result;
	});

	/**
	 * Skill key to its new point total. An unbalanced move is not offered at all: a point taken
	 * and never placed would be a point lost, so it stays where it is until the player places it.
	 */
	const skillTotals = $derived.by(() => {
		const result = new Map<string, number>();
		if (hasUnplacedPoint) return result;

		for (const [key, change] of Object.entries(skillChanges)) {
			if (change === 0) continue;
			result.set(key, (getProps().skills[key]?.points ?? 0) + change);
		}
		return result;
	});

	// A pool the player has not touched starts on the picks the character already holds.
	$effect(() => {
		const seeded = new Map(selectedByPool);
		let hasChanges = false;

		for (const pool of pools) {
			if (seeded.has(pool.poolKey)) continue;
			const owned = new Set(pool.ownedUuids);
			seeded.set(
				pool.poolKey,
				pool.candidates.filter((candidate) => owned.has(candidate.uuid ?? '')),
			);
			hasChanges = true;
		}

		if (hasChanges) selectedByPool = seeded;
	});

	function canSubtractPoint(row: { points: number; change: number }): boolean {
		if (row.points < 1) return false;
		// Taking back a point the player just placed costs no budget.
		if (row.change > 0) return true;
		return pointsTaken < skillBudget;
	}

	function getSubtractTooltip(row: { points: number; change: number }): string {
		if (row.points < 1) return localize('NIMBLE.optionSwap.skillCannotGoBelowZero');
		if (row.change > 0) return '';
		if (pointsTaken >= skillBudget) return localize('NIMBLE.optionSwap.skillBudgetSpent');
		return '';
	}

	function canAddPoint(row: { mod: number; change: number }): boolean {
		if (row.mod >= MAX_SKILL_MODIFIER) return false;
		// Putting back a point the player just took needs no banked point.
		if (row.change < 0) return true;
		return pointsPlaced < pointsTaken;
	}

	function getAddTooltip(row: { mod: number; change: number }): string {
		if (row.mod >= MAX_SKILL_MODIFIER) return localize('NIMBLE.optionSwap.skillAtMaximum');
		if (row.change < 0) return '';
		if (pointsPlaced >= pointsTaken) return localize('NIMBLE.optionSwap.takeAPointFirst');
		return '';
	}

	function adjustSkill(skillKey: string, delta: number) {
		const row = skillRows.find((candidate) => candidate.key === skillKey);
		if (!row) return;
		if (delta > 0 ? !row.canAdd : !row.canSubtract) return;

		skillChanges = { ...skillChanges, [skillKey]: (skillChanges[skillKey] ?? 0) + delta };
	}

	function getSelectedFeatures(poolKey: string): NimbleFeatureItem[] {
		return selectedByPool.get(poolKey) ?? [];
	}

	function toggleFeature(poolKey: string, feature: NimbleFeatureItem) {
		const pool = pools.find((candidate) => candidate.poolKey === poolKey);
		if (!pool) return;

		const current = getSelectedFeatures(poolKey);
		const isSelected = current.some((selected) => selected.uuid === feature.uuid);

		let next: NimbleFeatureItem[];
		if (isSelected) {
			next = current.filter((selected) => selected.uuid !== feature.uuid);
		} else if (current.length >= pool.pickCount) {
			return;
		} else {
			next = [...current, feature];
		}

		const updated = new Map(selectedByPool);
		updated.set(poolKey, next);
		selectedByPool = updated;
	}

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	return {
		get hasOffer() {
			return hasOffer;
		},
		get isExpanded() {
			return isExpanded;
		},
		get groups() {
			return groups;
		},
		get requiredActs() {
			return requiredActs;
		},
		get skillBudget() {
			return skillBudget;
		},
		get skillRows() {
			return skillRows;
		},
		get pointsTaken() {
			return pointsTaken;
		},
		get pointsPlaced() {
			return pointsPlaced;
		},
		get hasUnplacedPoint() {
			return hasUnplacedPoint;
		},
		get selectionUuids() {
			return selectionUuids;
		},
		get skillTotals() {
			return skillTotals;
		},
		adjustSkill,
		getSelectedFeatures,
		toggleExpanded,
		toggleFeature,
	};
}
