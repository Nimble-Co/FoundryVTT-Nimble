/**
 * Resolve the `@n` / `@sum` placeholders a dice-consumer effect formula uses to
 * describe the dice the player just picked: `@n` is how many were selected,
 * `@sum` their combined face value (e.g. Death Blow's `2 * @sum`).
 *
 * Shared by the sheet's spend panel and the chat-card spend offer so both
 * entry points resolve an author's formula identically.
 */
export function substituteSpendFormula(formula: string, count: number, sum: number): string {
	return formula.replace(/@n\b/g, String(count)).replace(/@sum\b/g, String(sum));
}
