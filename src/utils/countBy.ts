/** How many times each value appears, in order of first appearance. */
export default function countBy<T>(values: readonly T[]): Map<T, number> {
	const counts = new Map<T, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return counts;
}
