/** Core Rules: 1 action, 2 at 10+, 3 at 20+ or on a natural 20. `naturalD20` is the kept d20. */
export function getInitiativeStartingActions(
	total: number,
	naturalD20: number | null = null,
): number {
	if (total >= 20 || naturalD20 === 20) return 3;
	if (total >= 10) return 2;
	return 1;
}
