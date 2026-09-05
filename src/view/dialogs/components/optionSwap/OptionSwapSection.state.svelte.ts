import { untrack } from 'svelte';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { OptionSwapChange } from '#types/components/OptionSwapSection.d.ts';
import type { ResolvedOptionSwapOffer, ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';
import formatGroupName from '#utils/formatGroupName.js';
import localize from '#utils/localize.js';
import { MAX_SKILL_MODIFIER } from '#utils/skillLimits.js';
import sortDocumentsByName from '#utils/sortDocumentsByName.js';

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

/** One pool as the section lays it out: the picks held on top, the rest of the pool below. */
export interface OptionSwapPoolView {
	pool: ResolvedSwappableOptionPool;
	heading: string;
	/** How many picks the pool asks for, e.g. "(Choose 2)". */
	pickHint: string;
	/** How many the player holds against that, e.g. "1 of 2 selected". */
	progressText: string;
	selected: NimbleFeatureItem[];
	available: NimbleFeatureItem[];
	isFull: boolean;
	/** Whether the rest of the pool is unfolded. It starts folded to keep the section short. */
	showsAvailable: boolean;
	availableToggleLabel: string;
}

interface OptionSwapSectionStateProps {
	offer: ResolvedOptionSwapOffer | null;
	skills: Record<string, OptionSwapSkillData>;
	/** Told the whole picture — every pick and every moved point — after each change. */
	onChange: (change: OptionSwapChange) => void;
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
	let unfoldedPools = $state<Set<string>>(new Set());
	let selectedByPool = $state<Map<string, NimbleFeatureItem[]>>(new Map());
	let skillChanges = $state<Record<string, number>>({});

	const pools = $derived(getProps().offer?.pools ?? []);
	const skillBudget = $derived(getProps().offer?.skillPoints ?? 0);
	const sources = $derived(
		(getProps().offer?.sources ?? []).map((source) =>
			source.name
				? localize('NIMBLE.optionSwap.sourceQuote', { name: source.name, text: source.text })
				: source.text,
		),
	);
	const hasOffer = $derived(pools.length > 0 || skillBudget > 0);

	const poolViews = $derived.by((): OptionSwapPoolView[] =>
		pools.map((pool) => {
			const selected = getSelectedFeatures(pool.poolKey);
			const selectedUuids = new Set(selected.map((feature) => feature.uuid));
			const available = sortDocumentsByName(
				pool.candidates.filter((candidate) => !selectedUuids.has(candidate.uuid)),
			);
			const showsAvailable = unfoldedPools.has(pool.poolKey);
			return {
				pool,
				heading: pool.displayName || formatGroupName(pool.poolKey),
				pickHint:
					pool.pickCount === 1
						? localize('NIMBLE.classFeatureSelection.chooseOne')
						: localize('NIMBLE.classFeatureSelection.chooseN', {
								count: String(pool.pickCount),
							}),
				progressText: localize('NIMBLE.classFeatureSelection.nOfMSelected', {
					current: String(selected.length),
					required: String(pool.pickCount),
				}),
				selected: sortDocumentsByName(selected),
				available,
				isFull: selected.length >= pool.pickCount,
				showsAvailable,
				availableToggleLabel: showsAvailable
					? localize('NIMBLE.optionSwap.hideAvailable')
					: available.length === 1
						? localize('NIMBLE.optionSwap.showOneAvailable')
						: localize('NIMBLE.optionSwap.showAvailable', { count: String(available.length) }),
			};
		}),
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

		if (!hasChanges) return;

		selectedByPool = seeded;
		untrack(notifyChange);
	});

	function notifyChange() {
		getProps().onChange({ selections: selectionUuids, skillPoints: skillTotals });
	}

	/**
	 * A point can only leave a skill that holds one, and only while the skill it leaves keeps a
	 * bonus of +0 or better — a negative ability can hold the bonus under the points the skill
	 * shows, so the two floors are not the same test.
	 */
	function canSubtractPoint(row: { points: number; mod: number; change: number }): boolean {
		if (row.points < 1) return false;
		if (row.mod < 1) return false;
		// Taking back a point the player just placed costs no budget.
		if (row.change > 0) return true;
		return pointsTaken < skillBudget;
	}

	function getSubtractTooltip(row: { points: number; mod: number; change: number }): string {
		if (row.points < 1) return localize('NIMBLE.optionSwap.skillCannotGoBelowZero');
		if (row.mod < 1) return localize('NIMBLE.optionSwap.skillBonusCannotGoNegative');
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
		notifyChange();
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
		} else if (current.length < pool.pickCount) {
			next = [...current, feature];
		} else if (pool.pickCount === 1) {
			// With one pick there is nothing to choose between, so a click is the swap.
			next = [feature];
		} else {
			return;
		}

		const updated = new Map(selectedByPool);
		updated.set(poolKey, next);
		selectedByPool = updated;
		notifyChange();
	}

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function toggleAvailable(poolKey: string) {
		const next = new Set(unfoldedPools);
		if (next.has(poolKey)) next.delete(poolKey);
		else next.add(poolKey);
		unfoldedPools = next;
	}

	return {
		get hasOffer() {
			return hasOffer;
		},
		get isExpanded() {
			return isExpanded;
		},
		get poolViews() {
			return poolViews;
		},
		get sources() {
			return sources;
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
		adjustSkill,
		getSelectedFeatures,
		toggleAvailable,
		toggleExpanded,
		toggleFeature,
	};
}
