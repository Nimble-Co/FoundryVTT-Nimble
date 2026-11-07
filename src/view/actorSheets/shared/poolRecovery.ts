/**
 * When the uses of a pool come back. The start of each creature's turn reads
 * "turn". The owner's own turn start and turn end read "round".
 */
export type PoolRecovery = 'turn' | 'round' | 'safeRest' | 'fieldRest' | 'encounter';

const RECOVERY_ORDER: [PoolRecovery, string[]][] = [
	['turn', ['onAnyTurnStart']],
	['round', ['onTurnStart', 'onTurnEnd']],
	['encounter', ['encounterStart', 'encounterEnd']],
	['fieldRest', ['fieldRest']],
	['safeRest', ['safeRest']],
];

/** The most frequent recovery of the pool, in the words of the row. */
export function recoveryOf(triggers: string[]): PoolRecovery | null {
	return (
		RECOVERY_ORDER.find(([, names]) => names.some((name) => triggers.includes(name)))?.[0] ?? null
	);
}
