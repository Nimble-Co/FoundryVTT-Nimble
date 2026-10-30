/**
 * The one target, when there is exactly one. A rule that tests the target
 * reads it; with two or more targets such a rule does not run.
 */
export function soleTarget<T>(targets: Iterable<T> | null | undefined): T | null {
	const all = Array.from(targets ?? []);
	return all.length === 1 ? all[0] : null;
}
