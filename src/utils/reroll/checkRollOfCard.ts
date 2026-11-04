import type { CheckRollKind } from './rollToReroll.js';

type CheckRoll = { kind: CheckRollKind; key: string };

interface DieLike {
	faces?: number;
	results?: Array<{ result?: number; active?: boolean }>;
}

const CHECK_CARD_KEYS = {
	savingThrow: { kind: 'save', keyField: 'saveKey' },
	skillCheck: { kind: 'skillCheck', keyField: 'skillKey' },
	abilityCheck: { kind: 'abilityCheck', keyField: 'abilityKey' },
} as const;

/** The check a card of this type holds, or null when it is not a check card. */
function checkRollOfCard(type: string, system: Record<string, unknown>): CheckRoll | null {
	if (type === 'initiative') return { kind: 'initiative', key: '' };
	const card = CHECK_CARD_KEYS[type as keyof typeof CHECK_CARD_KEYS];
	if (!card) return null;
	const key = system[card.keyField];
	return typeof key === 'string' && key ? { kind: card.kind, key } : null;
}

/** The kept d20 result in a roll's terms, or null. */
function keptD20(terms: unknown[]): number | null {
	const die = terms.find((term) => (term as DieLike | null)?.faces === 20) as DieLike | undefined;
	const kept = (die?.results ?? []).filter(
		(result) => result.active !== false && typeof result.result === 'number',
	);
	if (kept.length === 0) return null;
	return kept.reduce((sum, result) => sum + (result.result ?? 0), 0);
}

export { checkRollOfCard, keptD20, type CheckRoll };
