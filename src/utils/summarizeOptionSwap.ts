import type { OptionChange } from '#managers/RestManager.ts';
import type { ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';
import countBy from '#utils/countBy.ts';
import localize from '#utils/localize.js';
import { isSelectionApplicable } from '#utils/planOptionSwap.ts';

/**
 * Describes a set of swaps in names rather than uuids, so the rest card can report what
 * changed without resolving anything later.
 *
 * What moved is the same count difference the planner acts on, and both read the same rule
 * for whether a selection is applied at all, so the card and the plan cannot disagree. An
 * option that moved more than once is named once with its count.
 *
 * A pool whose selection did not change is left out, which is what keeps an ordinary rest
 * from posting an empty "options changed" block.
 */
export default function summarizeOptionSwap(
	pools: readonly ResolvedSwappableOptionPool[],
	selections: ReadonlyMap<string, readonly string[]>,
	skillChanges: ReadonlyMap<string, { from: number; to: number }> = new Map(),
	skillLabel: (skillKey: string) => string = (skillKey) => skillKey,
): OptionChange[] {
	const changes: OptionChange[] = [];

	for (const pool of pools) {
		const selected = selections.get(pool.poolKey);
		if (!selected) continue;
		// The same guard the planner applies: an incomplete selection is not a swap, so it must
		// not be reported as one.
		if (!isSelectionApplicable(selected.length, pool.heldCount, pool.grantedCount)) continue;

		const wanted = countBy(selected);

		const nameByUuid = new Map(
			pool.candidates.map((candidate) => [candidate.uuid ?? '', candidate.name ?? '']),
		);
		const nameOf = (uuid: string, count: number) => {
			const name = nameByUuid.get(uuid) || uuid;
			return count > 1
				? localize('NIMBLE.optionSwap.countedName', { name, count: String(count) })
				: name;
		};

		const removed: string[] = [];
		for (const [uuid, ids] of pool.heldIdsByUuid) {
			const lost = ids.length - (wanted.get(uuid) ?? 0);
			if (lost > 0) removed.push(nameOf(uuid, lost));
		}

		const added: string[] = [];
		for (const [uuid, count] of wanted) {
			const gained = count - (pool.heldIdsByUuid.get(uuid)?.length ?? 0);
			if (gained > 0) added.push(nameOf(uuid, gained));
		}

		if (removed.length === 0 && added.length === 0) continue;

		changes.push({
			// The same heading the rest dialog showed the pool under.
			label: pool.displayName,
			removed,
			added,
		});
	}

	for (const [skillKey, { from, to }] of skillChanges) {
		if (from === to) continue;
		// A move is reported as one line per skill, so both halves are visible and the table
		// can see that the total did not change.
		const label = skillLabel(skillKey);
		const range = localize('NIMBLE.optionSwap.skillPointRange', {
			from: String(from),
			to: String(to),
		});
		if (to > from) changes.push({ label, removed: [], added: [range] });
		else changes.push({ label, removed: [range], added: [] });
	}

	return changes;
}
