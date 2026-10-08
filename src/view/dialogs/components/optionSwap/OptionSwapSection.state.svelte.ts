import { untrack } from 'svelte';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	OptionSwapCardView,
	OptionSwapChange,
	OptionSwapChoice,
	OptionSwapListView,
	OptionSwapPlace,
	OptionSwapPoolView,
	OptionSwapStatus,
	ResolvedOptionSwapOffer,
	ResolvedSwappableOptionPool,
} from '#types/optionSwap.d.ts';
import countBy from '#utils/countBy.ts';
import formatGroupName from '#utils/formatGroupName.ts';
import localize from '#utils/localize.ts';
import { isSelectionApplicable } from '#utils/planOptionSwap.ts';
import type { OptionSwapSource } from '#utils/resolveOptionSwapOffer.ts';
import { MAX_SKILL_MODIFIER } from '#utils/skillLimits.ts';
import sortDocumentsByName from '#utils/sortDocumentsByName.ts';
import replaceHyphenWithMinusSign from '../../../dataPreparationHelpers/replaceHyphenWithMinusSign.ts';

const DEFAULT_SOURCE_IMAGE = 'icons/svg/book.svg';

/**
 * One place of a pool: what stands in it, and the last pick that did. An empty place keeps
 * the list of the pick it was emptied of, so it stays under that heading.
 */
interface OptionSwapPlaceEntry {
	uuid: string | null;
	lastUuid: string | null;
}

export interface OptionSwapSkillData {
	points: number;
	mod: number;
}

export interface OptionSwapSkillRow {
	key: string;
	name: string;
	/** The skill with the total it rolls with now, e.g. "Arcana (+4)". */
	label: string;
	/** The total the character rolls with now. */
	total: number;
	/** The total after every pending move. */
	nextTotal: number;
	/** Whether this skill may give a point away. */
	canGive: boolean;
	/** Whether this skill may take a point. */
	canTake: boolean;
}

/** One point the offer lets the player move: where it comes from, and where it goes. */
export interface OptionSwapSkillMove {
	from: string;
	to: string;
	/** What this move does to the two skills, in words. Empty until the point is placed. */
	summary: string;
	/** Whether the point was taken and not yet placed. */
	needsTarget: boolean;
}

interface OptionSwapSectionStateProps {
	offer: ResolvedOptionSwapOffer | null;
	skills: Record<string, OptionSwapSkillData>;
	/** Told the whole picture, every pick and every moved point, after each change. */
	onChange: (change: OptionSwapChange) => void;
}

export type OptionSwapSectionState = ReturnType<typeof createOptionSwapSectionState>;

/**
 * Creates reactive state for the OptionSwapSection component: one card per offering feature,
 * each pool a fixed row of places that starts on what the sheet holds, and one line per skill
 * point the offer lets the player move.
 */
export function createOptionSwapSectionState(getProps: () => OptionSwapSectionStateProps) {
	let isExpanded = $state(false);
	let unfoldedPools = $state<Set<string>>(new Set());
	let placesByPool = $state<Map<string, OptionSwapPlaceEntry[]>>(new Map());
	let skillPairs = $state<SkillMovePair[]>([]);

	const pools = $derived(getProps().offer?.pools ?? []);
	const sources = $derived(getProps().offer?.sources ?? []);
	const skillBudget = $derived(getProps().offer?.skillPoints ?? 0);
	// One line per point the offer holds. Lines the player never touched are empty.
	const movePairs = $derived.by((): SkillMovePair[] =>
		Array.from({ length: skillBudget }, (_, index) => skillPairs[index] ?? EMPTY_MOVE),
	);
	// An empty set is the resolver's word for "no swap rule on this rest"; `null` is every pool.
	const offersPools = $derived.by(() => {
		const offer = getProps().offer;
		return offer ? offer.allowedGroups?.size !== 0 : false;
	});
	const hasOffer = $derived(offersPools || skillBudget > 0);

	const poolViews = $derived.by((): OptionSwapPoolView[] => pools.map(buildPoolView));

	/** The held items the selection lets go of, across every pool. */
	const releasedItemIds = $derived.by(() => {
		const released = new Set<string>();
		for (const pool of pools) {
			const counts = countBy(picksOf(pool));
			for (const [uuid, ids] of pool.heldIdsByUuid) {
				const keep = counts.get(uuid) ?? 0;
				for (const id of ids.slice(0, Math.max(0, ids.length - keep))) released.add(id);
			}
		}
		return released;
	});

	// Each feature holds the lines for its own points, in the order the cards stand.
	const cards = $derived.by((): OptionSwapCardView[] => {
		const drafts = sources.map((source) => ({ source, pools: [] as OptionSwapPoolView[] }));
		const claim = (view: OptionSwapPoolView) =>
			drafts.find((draft) => draft.source.groups.some((group) => covers(view, group))) ??
			drafts.find((draft) => draft.source.coversAllGroups) ??
			drafts.find((draft) => offersSwap(draft.source)) ??
			drafts[0];

		const orphaned: OptionSwapPoolView[] = [];
		for (const view of poolViews) {
			const draft = claim(view);
			if (draft) draft.pools.push(view);
			else orphaned.push(view);
		}

		let taken = 0;
		const views = drafts
			.filter((draft) => draft.pools.length > 0 || draft.source.skillPoints > 0)
			.map((draft, index) => {
				const indices = lineRange(taken, draft.source.skillPoints);
				taken += indices.length;
				return buildCard(draft.source, draft.pools, index, indices);
			});

		// A point whose rule names no feature still has to be movable, so the last card that
		// offers a move takes the lines no card claimed.
		const spare = lineRange(taken, skillBudget - taken);
		const last = views.findLast((view) => view.skillMoveIndices.length > 0);
		if (last) last.skillMoveIndices.push(...spare);

		// A pool with no feature to sit under still belongs on screen, under a plain heading.
		if (orphaned.length > 0) views.push(buildCard(null, orphaned, views.length, []));
		return views;
	});

	/** What each complete move does to the point totals, added up across the lines. */
	const skillChanges = $derived.by(() => {
		const changes = new Map<string, number>();
		for (const move of movePairs) {
			if (!move.from || !move.to) continue;
			addChange(changes, move.from, -1);
			addChange(changes, move.to, 1);
		}
		return changes;
	});

	/** The same, plus a point taken and not yet placed: it is out of its skill already. */
	const heldChanges = $derived.by(() => {
		const changes = new Map(skillChanges);
		for (const move of movePairs) {
			if (move.from && !move.to) addChange(changes, move.from, -1);
		}
		return changes;
	});

	const skillRows = $derived.by((): OptionSwapSkillRow[] => {
		const skillNames = CONFIG.NIMBLE.skills as Record<string, string>;

		return Object.entries(getProps().skills)
			.map(([key, skill]) => {
				const name = skillNames[key] ?? key;
				const held = heldChanges.get(key) ?? 0;
				return {
					key,
					name,
					label: localize('NIMBLE.optionSwap.skillOption', {
						name,
						total: replaceHyphenWithMinusSign(skill.mod),
					}),
					total: skill.mod,
					nextTotal: skill.mod + (skillChanges.get(key) ?? 0),
					// A point can only leave a skill that holds one, and only while the bonus it
					// leaves stays at +0 or better. A negative ability can hold the bonus under the
					// points the skill shows, so the two floors are not the same test.
					canGive: skill.points + held >= 1 && skill.mod + held >= 1,
					canTake: skill.mod + held < MAX_SKILL_MODIFIER,
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	// Each line reads the totals the lines above it leave behind, so two points off one skill
	// count down from where the first one left it.
	const skillMoves = $derived.by((): OptionSwapSkillMove[] => {
		const running = new Map<string, number>();

		return movePairs.map((move) => {
			const needsTarget = Boolean(move.from) && !move.to;
			const from = skillRows.find((row) => row.key === move.from);
			const to = skillRows.find((row) => row.key === move.to);
			if (!from || !to) return { from: move.from, to: move.to, summary: '', needsTarget };

			const fromTotal = from.total + (running.get(move.from) ?? 0);
			const toTotal = to.total + (running.get(move.to) ?? 0);
			addChange(running, move.from, -1);
			addChange(running, move.to, 1);

			return {
				from: move.from,
				to: move.to,
				needsTarget,
				summary: localize('NIMBLE.optionSwap.skillMoveResult', {
					fromName: from.name,
					fromTotal: replaceHyphenWithMinusSign(fromTotal),
					fromNext: replaceHyphenWithMinusSign(fromTotal - 1),
					toName: to.name,
					toTotal: replaceHyphenWithMinusSign(toTotal),
					toNext: replaceHyphenWithMinusSign(toTotal + 1),
				}),
			};
		});
	});

	const hasUnplacedPoint = $derived(skillMoves.some((move) => move.needsTarget));

	/** Pool key to chosen uuids, once per pick, the shape `planOptionSwap` reads. */
	const selectionUuids = $derived.by(() => {
		const result = new Map<string, string[]>();
		for (const pool of pools) {
			if (placesByPool.has(pool.poolKey)) result.set(pool.poolKey, picksOf(pool));
		}
		return result;
	});

	/**
	 * Skill key to its new point total, across every line. An unbalanced line is not offered at
	 * all: a point taken and never placed would be a point lost, so it stays where it is until
	 * the player places it.
	 */
	const skillTotals = $derived.by(() => {
		const result = new Map<string, number>();
		const skills = getProps().skills;
		for (const [key, change] of skillChanges) {
			result.set(key, (skills[key]?.points ?? 0) + change);
		}
		return result;
	});

	/** Whether confirming the rest would change anything the section offers. */
	const isPending = $derived(
		poolViews.some((view) => view.status.changed && view.status.isReady) || skillChanges.size > 0,
	);

	// A pool the player has not touched starts on the picks the sheet holds, one place per held
	// item, so a member held twice opens already standing in two places.
	$effect(() => {
		const seeded = new Map(placesByPool);
		const unfolded = new Set(untrack(() => unfoldedPools));
		let hasChanges = false;

		for (const pool of pools) {
			if (seeded.has(pool.poolKey)) continue;
			seeded.set(pool.poolKey, seedPlaces(pool));
			// Nothing held is nothing to trade away, so the pool opens on what can be taken.
			if (pool.heldCount === 0) unfolded.add(pool.poolKey);
			hasChanges = true;
		}

		if (!hasChanges) return;

		placesByPool = seeded;
		unfoldedPools = unfolded;
		untrack(notifyChange);
	});

	// What a feature lets the player do is not offered on the rest that gives that feature up,
	// so every point it moved goes back where it was.
	$effect(() => {
		const isLost = cards.some((card) => card.offersSkillMove && card.isGivenUp);
		if (!isLost) return;
		if (!skillPairs.some((move) => move.from || move.to)) return;

		skillPairs = [];
		untrack(notifyChange);
	});

	// A smaller offer holds fewer points, so the lines it no longer has go with it.
	$effect(() => {
		if (skillPairs.length <= skillBudget) return;

		const dropped = skillPairs.slice(skillBudget).some((move) => move.from && move.to);
		skillPairs = skillPairs.slice(0, skillBudget);
		if (dropped) untrack(notifyChange);
	});

	function notifyChange() {
		getProps().onChange({ selections: selectionUuids, skillPoints: skillTotals });
	}

	function buildPoolView(pool: ResolvedSwappableOptionPool): OptionSwapPoolView {
		const places = placesOf(pool);
		const picks = picksOf(pool);
		const counts = countBy(picks);
		const repeatable = new Set(pool.repeatableUuids);
		const byUuid = new Map(pool.candidates.map((candidate) => [uuidOf(candidate), candidate]));

		const placeViews = places.map(
			(entry, index): OptionSwapPlace => ({
				index,
				feature: entry.uuid ? (byUuid.get(entry.uuid) ?? null) : null,
				isRepeatable: entry.uuid ? repeatable.has(entry.uuid) : false,
			}),
		);

		// What may fill a place: the members with no pick, plus those a grant lets be taken again.
		const choices = sortDocumentsByName(
			pool.candidates.filter(
				(candidate) => !counts.has(uuidOf(candidate)) || repeatable.has(uuidOf(candidate)),
			),
		).map(
			(feature): OptionSwapChoice => ({ feature, isRepeatable: repeatable.has(uuidOf(feature)) }),
		);

		const isReady = isSelectionApplicable(picks.length, pool.heldCount, pool.grantedCount);
		const showsChoices = unfoldedPools.has(pool.poolKey);

		return {
			pool,
			places: placeViews,
			choices,
			lists: buildLists(pool, places, placeViews, choices),
			countText: localize('NIMBLE.optionSwap.countPair', {
				chosen: String(picks.length),
				granted: String(pool.grantedCount),
			}),
			isOverGrant: picks.length > pool.grantedCount,
			isUnderGrant: picks.length < pool.grantedCount,
			hasEmptyPlace: places.some((entry) => entry.uuid === null),
			holdingsText: buildHoldingsText(pool.heldCount, pool.grantedCount),
			status: buildStatus(pool, counts, picks.length, isReady),
			showsChoices,
			choicesToggleLabel: showsChoices
				? localize('NIMBLE.optionSwap.hideChoices')
				: choices.length === 1
					? localize('NIMBLE.optionSwap.showOneChoice')
					: localize('NIMBLE.optionSwap.showChoices', { count: String(choices.length) }),
		};
	}

	function buildCard(
		source: OptionSwapSource | null,
		cardPools: OptionSwapPoolView[],
		index: number,
		skillMoveIndices: number[],
	): OptionSwapCardView {
		const name = source?.name || localize('NIMBLE.optionSwap.classOptions');
		const offersSkillMove = (source?.skillPoints ?? 0) > 0;
		const itemId = itemIdOf(source?.uuid ?? '');

		return {
			key: source?.uuid || source?.name || `pools-${index}`,
			name,
			img: source?.img || DEFAULT_SOURCE_IMAGE,
			subtitle: buildSubtitle(cardPools.length > 0, offersSkillMove),
			itemId,
			pools: cardPools,
			offersSkillMove,
			skillMoveIndices,
			isGivenUp: Boolean(itemId) && releasedItemIds.has(itemId),
			givenUpText: localize('NIMBLE.optionSwap.givenUpCard', { name }),
		};
	}

	function covers(view: OptionSwapPoolView, group: string): boolean {
		return view.pool.poolGroups.includes(group);
	}

	function offersSwap(source: OptionSwapSource): boolean {
		return source.coversAllGroups || source.groups.length > 0;
	}

	function seedPlaces(pool: ResolvedSwappableOptionPool): OptionSwapPlaceEntry[] {
		const held: OptionSwapPlaceEntry[] = [];
		for (const candidate of pool.candidates) {
			const ids = pool.heldIdsByUuid.get(uuidOf(candidate)) ?? [];
			for (const _id of ids) held.push({ uuid: uuidOf(candidate), lastUuid: uuidOf(candidate) });
		}
		// A character holding more than their levels grant may still trade every pick, so the
		// room a pool has is the larger of the two.
		const capacity = Math.max(pool.heldCount, pool.grantedCount);
		const empty = Math.max(0, capacity - held.length);
		return [...held, ...Array.from({ length: empty }, () => ({ uuid: null, lastUuid: null }))];
	}

	function placesOf(pool: ResolvedSwappableOptionPool): OptionSwapPlaceEntry[] {
		return placesByPool.get(pool.poolKey) ?? seedPlaces(pool);
	}

	function picksOf(pool: ResolvedSwappableOptionPool): string[] {
		return placesOf(pool)
			.map((entry) => entry.uuid)
			.filter((uuid): uuid is string => uuid !== null);
	}

	function setPlaces(poolKey: string, next: OptionSwapPlaceEntry[]) {
		const updated = new Map(placesByPool);
		updated.set(poolKey, next);
		placesByPool = updated;
		notifyChange();
	}

	/** Empties a place, which sends its pick back among the choices. */
	function giveUpPlace(poolKey: string, index: number) {
		const places = placesByPool.get(poolKey) ?? [];
		const entry = places[index];
		if (!entry?.uuid) return;

		const next = [...places];
		next[index] = { uuid: null, lastUuid: entry.uuid };
		setPlaces(poolKey, next);
		// The pick lands among the choices, which are not rendered while folded, so it would
		// otherwise vanish from under the player.
		unfoldChoices(poolKey);
	}

	/** Fills the first empty place with a member, while the pool has one. */
	function fillPlace(poolKey: string, feature: NimbleFeatureItem) {
		const places = placesByPool.get(poolKey) ?? [];
		const index = places.findIndex((entry) => entry.uuid === null);
		if (index < 0) return;

		const next = [...places];
		next[index] = { uuid: uuidOf(feature), lastUuid: uuidOf(feature) };
		setPlaces(poolKey, next);
	}

	function writeMove(index: number, move: SkillMovePair) {
		const next = [...movePairs];
		next[index] = move;
		skillPairs = next;
		notifyChange();
	}

	function setSkillFrom(index: number, key: string) {
		const move = movePairs[index];
		if (!move) return;
		writeMove(index, { from: key, to: move.to === key ? '' : move.to });
	}

	function setSkillTo(index: number, key: string) {
		const move = movePairs[index];
		if (!move?.from) return;
		writeMove(index, { from: move.from, to: key });
	}

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function toggleChoices(poolKey: string) {
		const next = new Set(unfoldedPools);
		if (next.has(poolKey)) next.delete(poolKey);
		else next.add(poolKey);
		unfoldedPools = next;
	}

	function unfoldChoices(poolKey: string) {
		if (unfoldedPools.has(poolKey)) return;
		unfoldedPools = new Set([...unfoldedPools, poolKey]);
	}

	return {
		get cards() {
			return cards;
		},
		get hasOffer() {
			return hasOffer;
		},
		get hasUnplacedPoint() {
			return hasUnplacedPoint;
		},
		get isExpanded() {
			return isExpanded;
		},
		get isPending() {
			return isPending;
		},
		get skillMoves() {
			return skillMoves;
		},
		get skillRows() {
			return skillRows;
		},
		fillPlace,
		giveUpPlace,
		setSkillFrom,
		setSkillTo,
		toggleChoices,
		toggleExpanded,
	};
}

/** One line's two ends. An end is empty until the player picks a skill for it. */
interface SkillMovePair {
	from: string;
	to: string;
}

const EMPTY_MOVE: SkillMovePair = { from: '', to: '' };

/** The line numbers of `count` points, starting at `start`. */
const lineRange = (start: number, count: number) =>
	Array.from({ length: Math.max(0, count) }, (_, offset) => start + offset);

function addChange(changes: Map<string, number>, key: string, amount: number) {
	changes.set(key, (changes.get(key) ?? 0) + amount);
}

const uuidOf = (feature: NimbleFeatureItem) => feature.uuid ?? '';

/** The last part of an owned document's uuid is its id, e.g. `Actor.abc.Item.xyz`. */
const itemIdOf = (uuid: string) => uuid.split('.').at(-1) ?? '';

const withCount = (name: string, count: number) =>
	count > 1 ? localize('NIMBLE.optionSwap.countedName', { name, count: String(count) }) : name;

/** What the feature offers, in words. */
function buildSubtitle(hasPools: boolean, offersSkillMove: boolean): string {
	if (hasPools && offersSkillMove) return localize('NIMBLE.optionSwap.cardBoth');
	if (offersSkillMove) return localize('NIMBLE.optionSwap.cardSkills');
	return localize('NIMBLE.optionSwap.cardSwap');
}

/**
 * The pool split by the list each member comes from: one list per group the pool names, in
 * that order, then one per option a level grants outright, headed by its own name. A list
 * with nothing in it is left out.
 */
function buildLists(
	pool: ResolvedSwappableOptionPool,
	entries: OptionSwapPlaceEntry[],
	places: OptionSwapPlace[],
	choices: OptionSwapChoice[],
): OptionSwapListView[] {
	const groups = new Set(pool.poolGroups);
	const byUuid = new Map(pool.candidates.map((candidate) => [uuidOf(candidate), candidate]));
	const lists = new Map<string, OptionSwapListView>();

	for (const group of pool.poolGroups) {
		lists.set(group, { key: group, heading: formatGroupName(group), places: [], choices: [] });
	}

	const extras = sortDocumentsByName(
		pool.candidates.filter((candidate) => !groups.has(candidate.system.group ?? '')),
	);
	for (const extra of extras) {
		const key = uuidOf(extra);
		lists.set(key, { key, heading: extra.name ?? '', places: [], choices: [] });
	}

	const keyOf = (uuid: string) => {
		const group = byUuid.get(uuid)?.system.group ?? '';
		return groups.has(group) ? group : uuid;
	};

	// A place the sheet never held belongs to no list of its own, so it waits in the first.
	const [firstList] = lists.values();

	for (const place of places) {
		const entry = entries[place.index];
		const uuid = entry?.uuid ?? entry?.lastUuid ?? null;
		const list = (uuid ? lists.get(keyOf(uuid)) : null) ?? firstList;
		list?.places.push(place);
	}

	for (const choice of choices) {
		lists.get(keyOf(uuidOf(choice.feature)))?.choices.push(choice);
	}

	return [...lists.values()].filter((list) => list.places.length > 0 || list.choices.length > 0);
}

/**
 * What confirming the rest would do to this pool, or nothing while the selection matches the
 * holdings. A selection that is neither a trade nor a fill says what is missing instead.
 */
function buildStatus(
	pool: ResolvedSwappableOptionPool,
	counts: Map<string, number>,
	chosenCount: number,
	isReady: boolean,
): OptionSwapStatus {
	const nameOf = (uuid: string) =>
		pool.candidates.find((candidate) => uuidOf(candidate) === uuid)?.name ?? uuid;

	const removed: string[] = [];
	for (const [uuid, ids] of pool.heldIdsByUuid) {
		const difference = ids.length - (counts.get(uuid) ?? 0);
		if (difference > 0) removed.push(withCount(nameOf(uuid), difference));
	}

	const added: string[] = [];
	for (const [uuid, count] of counts) {
		const difference = count - (pool.heldIdsByUuid.get(uuid)?.length ?? 0);
		if (difference > 0) added.push(withCount(nameOf(uuid), difference));
	}

	if (removed.length === 0 && added.length === 0) return { changed: false, isReady, text: '' };

	if (isReady) {
		return {
			changed: true,
			isReady,
			text:
				removed.length > 0
					? localize('NIMBLE.optionSwap.statusSwap', {
							removed: removed.join(', '),
							added: added.join(', '),
						})
					: localize('NIMBLE.optionSwap.statusTake', { added: added.join(', ') }),
		};
	}

	const missing = pool.heldCount - chosenCount;
	return { changed: true, isReady, text: buildIncompleteText(missing) };
}

function buildIncompleteText(missing: number): string {
	if (missing > 0) {
		return missing === 1
			? localize('NIMBLE.optionSwap.statusChooseOne')
			: localize('NIMBLE.optionSwap.statusChooseMore', { count: String(missing) });
	}
	return missing === -1
		? localize('NIMBLE.optionSwap.statusGiveUpOne')
		: localize('NIMBLE.optionSwap.statusGiveUpMore', { count: String(-missing) });
}

/** What the levels grant against what the sheet holds. Empty while the two agree. */
function buildHoldingsText(heldCount: number, grantedCount: number): string {
	if (heldCount === grantedCount) return '';

	const held = String(heldCount);
	const line =
		grantedCount === 1
			? localize('NIMBLE.optionSwap.holdingsLineOne', { held })
			: localize('NIMBLE.optionSwap.holdingsLine', { granted: String(grantedCount), held });

	if (heldCount >= grantedCount) return line;

	const missing = localize('NIMBLE.optionSwap.holdingsShortfall', {
		missing: String(grantedCount - heldCount),
	});
	return `${line} ${missing}`;
}
