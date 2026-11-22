/** The dice one target takes of an attack whose dice are divided. */
export interface DiceShare {
	targetUuid: string;
	dice: number;
}

/** The dice spread over the targets in order; the first ones take what does not divide evenly. */
export function evenDiceShares(dice: number, targetUuids: readonly string[]): DiceShare[] {
	const each = targetUuids.length > 0 ? Math.floor(dice / targetUuids.length) : 0;
	const left = dice - each * targetUuids.length;
	return targetUuids.map((targetUuid, index) => ({
		targetUuid,
		dice: each + (index < left ? 1 : 0),
	}));
}
