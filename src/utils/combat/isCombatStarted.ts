export function isCombatStarted(combat: Combat | null): boolean {
	if (!combat) return false;

	const asRecord = combat as unknown as { started?: boolean };
	if (typeof asRecord.started === 'boolean') return asRecord.started;

	return (combat.round ?? 0) > 0;
}
