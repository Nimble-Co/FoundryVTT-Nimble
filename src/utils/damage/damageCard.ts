import { SYSTEM_ID } from '#system';

let current: string | null = null;

/**
 * Runs `apply` as damage from the card `cardId`: the HP update it makes says so, so the hooks of
 * that update can put their lines on the card. `apply` must start its update before its first
 * await, as `applyDamage` does.
 */
export function withDamageCard<T>(cardId: string | null | undefined, apply: () => T): T {
	const before = current;
	current = cardId ?? null;
	try {
		return apply();
	} finally {
		current = before;
	}
}

/** The card whose Apply Damage is running now, if one is. */
export function currentDamageCard(): string | null {
	return current;
}

/** The update option that names the card whose Apply Damage changed the HP. */
export function damageCardOption(cardId: string | null | undefined): Record<string, unknown> {
	return cardId ? { [SYSTEM_ID]: { damageCardId: cardId } } : {};
}

/** The card whose Apply Damage made this actor update, from its update options. */
export function damageCardIdOf(options: unknown): string | null {
	const scope = (options as Record<string, { damageCardId?: unknown } | undefined> | null)?.[
		SYSTEM_ID
	];
	return typeof scope?.damageCardId === 'string' ? scope.damageCardId : null;
}
