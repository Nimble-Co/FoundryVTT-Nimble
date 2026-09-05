import type { OptionChange } from '#managers/RestManager.ts';
import type { ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';

/**
 * Describes a set of swaps in names rather than uuids, so the rest card can report what
 * changed without resolving anything later.
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

		const owned = new Set(pool.ownedUuids);
		const wanted = new Set(selected);

		const nameByUuid = new Map(
			pool.candidates.map((candidate) => [candidate.uuid ?? '', candidate.name ?? '']),
		);
		const nameOf = (uuid: string) => nameByUuid.get(uuid) || uuid;

		const removed = pool.ownedUuids.filter((uuid) => !wanted.has(uuid)).map(nameOf);
		const added = selected.filter((uuid) => !owned.has(uuid)).map(nameOf);
		if (removed.length === 0 && added.length === 0) continue;

		changes.push({
			label: pool.displayName || pool.optionLabel || pool.poolGroups.join(', '),
			removed,
			added,
		});
	}

	for (const [skillKey, { from, to }] of skillChanges) {
		if (from === to) continue;
		// A move is reported as one line per skill, so both halves are visible and the table
		// can see that the total did not change.
		const label = skillLabel(skillKey);
		if (to > from) changes.push({ label, removed: [], added: [`${label} ${from} to ${to}`] });
		else changes.push({ label, removed: [`${label} ${from} to ${to}`], added: [] });
	}

	return changes;
}
