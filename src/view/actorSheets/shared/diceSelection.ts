/**
 * The dice picked for one spend. A second click takes a die away. A spend with a cap
 * (an outcome that changes the dice) drops the oldest pick when a new die goes past it.
 */
export function toggleDie(selected: number[], index: number, cap: number | null): number[] {
	if (selected.includes(index)) return selected.filter((entry) => entry !== index);
	const next = [...selected, index];
	return cap !== null && next.length > cap ? next.slice(next.length - cap) : next;
}
