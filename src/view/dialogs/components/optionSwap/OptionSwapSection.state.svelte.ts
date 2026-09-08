import { untrack } from 'svelte';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	OptionSwapChange,
	ResolvedOptionSwapOffer,
	ResolvedSwappableOptionPool,
} from '#types/optionSwap.d.ts';
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

/** One member the player has selected, with how many times and what the card may do about it. */
export interface OptionSwapSelectedEntry {
	feature: NimbleFeatureItem;
	/** How many of the pool's picks this member takes in the pending selection. */
	count: number;
	/** Whether the card offers the control to take one more. Only a repeatable member does. */
	offersAnother: boolean;
	/** Whether taking one more is possible now, which it is not once the pool is full. */
	canTakeAnother: boolean;
	takeAnotherTooltip: string;
	/** Whether the card offers the control to give one up, which it does from a count of two. */
	canGiveUpOne: boolean;
}

/** One pool as the section lays it out: the picks held on top, the rest of the pool below. */
export interface OptionSwapPoolView {
	pool: ResolvedSwappableOptionPool;
	heading: string;
	/** How many picks the pool asks for, e.g. "(Choose 2)". */
	pickHint: string;
	/** How many the player holds against that, e.g. "1 of 2 selected". */
	progressText: string;
	selected: OptionSwapSelectedEntry[];
	available: NimbleFeatureItem[];
	isFull: boolean;
	/** Why an alternative cannot be taken while the pool is full. */
	fullHint: string;
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
 * The picks start on what the character's level-up history records, so the section opens
 * showing the picks as they stand and every change the player makes is a deliberate one. A
 * selection is a multiset of member uuids: a repeatable member may appear more than once, up
 * to the pool's pick count. The two lists follow that selection, not the picks. Skill points
 * move rather than accrue: a point can only be added to a skill once one has been taken from
 * another, which keeps the total the character earned by levelling untouched.
 */
export function createOptionSwapSectionState(getProps: () => OptionSwapSectionStateProps) {
	let isExpanded = $state(false);
	let unfoldedPools = $state<Set<string>>(new Set());
	let selectedByPool = $state<Map<string, string[]>>(new Map());
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
	// An empty set is the resolver's word for "no swap rule on this rest"; `null` is every pool.
	const offersPools = $derived.by(() => {
		const offer = getProps().offer;
		return offer ? offer.allowedGroups?.size !== 0 : false;
	});
	const hasOffer = $derived(offersPools || skillBudget > 0);
	/** Whether a swap is offered but the history records no pick to swap. */
	const hasNoPicks = $derived(offersPools && pools.length === 0);

	const poolViews = $derived.by((): OptionSwapPoolView[] =>
		pools.map((pool) => {
			const selectedUuids = getSelectedUuids(pool.poolKey);
			const counts = countSelected(selectedUuids);
			const isFull = selectedUuids.length >= pool.pickCount;
			const repeatable = new Set(pool.repeatableUuids);
			const selected = sortDocumentsByName(
				pool.candidates.filter((candidate) => counts.has(candidate.uuid ?? '')),
			).map((feature): OptionSwapSelectedEntry => {
				const count = counts.get(feature.uuid ?? '') ?? 0;
				// A one-pick pool is always full at one, so the control would never do anything.
				const offersAnother = repeatable.has(feature.uuid ?? '') && pool.pickCount > 1;
				return {
					feature,
					count,
					offersAnother,
					canTakeAnother: offersAnother && !isFull,
					takeAnotherTooltip: offersAnother && isFull ? localize('NIMBLE.optionSwap.poolFull') : '',
					canGiveUpOne: count > 1,
				};
			});
			const available = sortDocumentsByName(
				pool.candidates.filter((candidate) => !counts.has(candidate.uuid ?? '')),
			);
			const showsAvailable = unfoldedPools.has(pool.poolKey);
			return {
				pool,
				heading: pool.displayName,
				pickHint:
					pool.pickCount === 1
						? localize('NIMBLE.classFeatureSelection.chooseOne')
						: localize('NIMBLE.classFeatureSelection.chooseN', {
								count: String(pool.pickCount),
							}),
				progressText: localize('NIMBLE.classFeatureSelection.nOfMSelected', {
					current: String(selectedUuids.length),
					required: String(pool.pickCount),
				}),
				selected,
				available,
				isFull,
				fullHint: selected.some((entry) => entry.count > 1)
					? localize('NIMBLE.optionSwap.releaseAPickFirstCounted')
					: localize('NIMBLE.optionSwap.releaseAPickFirst'),
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

	/** Pool key to chosen uuids, once per pick, the shape `planOptionSwap` reads. */
	const selectionUuids = $derived.by(() => {
		const result = new Map<string, string[]>();
		for (const pool of pools) {
			const selected = selectedByPool.get(pool.poolKey);
			if (selected) result.set(pool.poolKey, [...selected]);
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

	// A pool the player has not touched starts on the picks the history records, one entry per
	// pick, so a member picked at two levels opens already showing two.
	$effect(() => {
		const seeded = new Map(selectedByPool);
		let hasChanges = false;

		for (const pool of pools) {
			if (seeded.has(pool.poolKey)) continue;
			const uuids: string[] = [];
			for (const candidate of pool.candidates) {
				const ids = pool.pickIdsByUuid.get(candidate.uuid ?? '') ?? [];
				for (const _id of ids) uuids.push(candidate.uuid ?? '');
			}
			seeded.set(pool.poolKey, uuids);
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

	function getSelectedUuids(poolKey: string): string[] {
		return selectedByPool.get(poolKey) ?? [];
	}

	function getSelectedFeatures(poolKey: string): NimbleFeatureItem[] {
		const pool = pools.find((candidate) => candidate.poolKey === poolKey);
		const counts = countSelected(getSelectedUuids(poolKey));
		return pool?.candidates.filter((candidate) => counts.has(candidate.uuid ?? '')) ?? [];
	}

	function setSelected(poolKey: string, next: string[]) {
		const updated = new Map(selectedByPool);
		updated.set(poolKey, next);
		selectedByPool = updated;
		notifyChange();
	}

	/**
	 * Selects a member from the alternatives, or releases one pick of a selected member. On the
	 * held side this is only reachable at a count of one, so a release always takes the member
	 * to zero and back among the alternatives.
	 */
	function toggleFeature(poolKey: string, feature: NimbleFeatureItem) {
		const pool = pools.find((candidate) => candidate.poolKey === poolKey);
		if (!pool) return;

		const uuid = feature.uuid ?? '';
		const current = getSelectedUuids(poolKey);
		const position = current.indexOf(uuid);

		let next: string[];
		if (position >= 0) {
			next = current.filter((_selected, index) => index !== position);
			// The released member lands among the alternatives, which are not rendered while
			// folded, so the card would otherwise vanish from under the player.
			unfoldAvailable(poolKey);
		} else if (current.length < pool.pickCount) {
			next = [...current, uuid];
		} else if (pool.pickCount === 1) {
			// With one pick there is nothing to choose between, so a click is the swap.
			next = [uuid];
		} else {
			return;
		}

		setSelected(poolKey, next);
	}

	/**
	 * Takes one more pick of a selected member, or gives one up. Only a repeatable member can go
	 * above one, only a pool with room can take another, and giving up never goes below one:
	 * the last pick is released through the card's deselect control instead.
	 */
	function adjustFeatureCount(poolKey: string, feature: NimbleFeatureItem, delta: 1 | -1) {
		const view = poolViews.find((candidate) => candidate.pool.poolKey === poolKey);
		const entry = view?.selected.find((candidate) => candidate.feature.uuid === feature.uuid);
		if (!view || !entry) return;
		if (delta > 0 ? !entry.canTakeAnother : !entry.canGiveUpOne) return;

		const uuid = feature.uuid ?? '';
		const current = getSelectedUuids(poolKey);
		if (delta > 0) {
			setSelected(poolKey, [...current, uuid]);
		} else {
			const position = current.lastIndexOf(uuid);
			setSelected(
				poolKey,
				current.filter((_selected, index) => index !== position),
			);
		}
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

	function unfoldAvailable(poolKey: string) {
		if (unfoldedPools.has(poolKey)) return;
		unfoldedPools = new Set([...unfoldedPools, poolKey]);
	}

	return {
		get hasOffer() {
			return hasOffer;
		},
		get hasNoPicks() {
			return hasNoPicks;
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
		adjustFeatureCount,
		adjustSkill,
		getSelectedFeatures,
		toggleAvailable,
		toggleExpanded,
		toggleFeature,
	};
}

/** How many times each uuid appears in a selection. */
function countSelected(uuids: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const uuid of uuids) counts.set(uuid, (counts.get(uuid) ?? 0) + 1);
	return counts;
}
