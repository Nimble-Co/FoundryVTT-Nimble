/** When the uses of a pool come back. Turn start and turn end both read "round". */
export type PoolRecovery = 'round' | 'safeRest' | 'fieldRest' | 'encounter';

const RECOVERY_ORDER: [PoolRecovery, string[]][] = [
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
