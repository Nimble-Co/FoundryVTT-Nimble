/** One hero's Defend against an attack card, as the card stores it. */
export interface DefendRecord {
	id: string;
	/** The Defended token: the attack's damage to it loses `armor`. */
	tokenUuid: string;
	actorUuid: string;
	armor: number;
	/** The GM turns this off for damage that cannot be avoided (Core:502). */
	armorApplies: boolean;
	/** The feature the hero Defended with; empty for the heroic reaction. */
	label: string;
	userId: string;
	combatantId: string;
	/** Actions before the Defend was paid, so an undo can give them back. */
	previousActions: number | null;
	reactionKeys: string[];
}

function isDefendRecord(value: unknown): value is DefendRecord {
	const record = value as Partial<DefendRecord> | null;
	return (
		typeof record?.id === 'string' &&
		typeof record.tokenUuid === 'string' &&
		typeof record.actorUuid === 'string'
	);
}

export function defendsOf(system: unknown): DefendRecord[] {
	const defends = (system as { defends?: unknown } | null)?.defends;
	if (!Array.isArray(defends)) return [];
	return defends.filter(isDefendRecord).map((record) => ({
		...record,
		armor: Math.max(0, Math.floor(Number(record.armor) || 0)),
		armorApplies: record.armorApplies !== false,
		label: record.label ?? '',
		userId: record.userId ?? '',
		combatantId: record.combatantId ?? '',
		previousActions: record.previousActions ?? null,
		reactionKeys: Array.isArray(record.reactionKeys) ? record.reactionKeys : [],
	}));
}

export function defendFor(system: unknown, tokenUuid: string): DefendRecord | null {
	return defendsOf(system).find((record) => record.tokenUuid === tokenUuid) ?? null;
}

/** The targets whose damage from this card is applied. */
export function damageAppliedTo(system: unknown): Set<string> {
	const applied = (system as { damageAppliedTo?: unknown } | null)?.damageAppliedTo;
	return new Set(Array.isArray(applied) ? applied.filter((uuid) => typeof uuid === 'string') : []);
}

/** Whether the card can hold Defends at all. */
export function cardTakesDefends(system: unknown): boolean {
	return Array.isArray((system as { defends?: unknown } | null)?.defends);
}
