/**
 * The one target, when there is exactly one. A rule that tests the target
 * reads it; with two or more targets such a rule does not run. With
 * `firstDecides`, an item's extra targets do not count: the first target is read.
 */
export function soleTarget<T>(
	targets: Iterable<T> | null | undefined,
	options: { firstDecides?: boolean } = {},
): T | null {
	const all = Array.from(targets ?? []);
	if (options.firstDecides) return all[0] ?? null;
	return all.length === 1 ? all[0] : null;
}
