const RESULT_OPTIONS = new Set(['netRollMode', 'primaryDieValue', 'primaryDieBaseResult']);

/**
 * Roll options for a reroll of a roll with `options`. A reroll keeps the
 * modifiers and drops results: a set primary die value and the values the
 * roll computed from its sources.
 */
function rerollOptions(
	options: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(options ?? {}).filter(([key]) => !RESULT_OPTIONS.has(key)),
	);
}

export { rerollOptions };
