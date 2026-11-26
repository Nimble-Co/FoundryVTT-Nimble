export interface PoolChangedPayload {
	poolId?: string;
	previousFaces?: number[];
	newFaces?: number[];
	reason?: string;
}

export interface ChargePoolChangedPayload {
	poolId?: string;
	previousValue?: number;
	newValue?: number;
}

/**
 * Actor-scoped pool ids carry an "actor:" prefix; rules name the bare
 * identifier in both scopes. Null when no identifier is left.
 */
function barePoolIdentifier(poolId: string | undefined): string | null {
	const id = poolId ?? '';
	return (id.startsWith('actor:') ? id.slice('actor:'.length) : id) || null;
}

/**
 * The identifier of the dice pool a pool-changed event added dice to, or null
 * when the event is no gain: the pool holds no more dice than before, or spent
 * dice were refunded.
 */
export function gainedPoolIdentifier(
	payload: PoolChangedPayload | null | undefined,
): string | null {
	if (!payload || payload.reason === 'refund') return null;
	if ((payload.newFaces?.length ?? 0) <= (payload.previousFaces?.length ?? 0)) return null;
	return barePoolIdentifier(payload.poolId);
}

/** The identifier of the charge pool a charge-pool-changed event added charges to, or null. */
export function gainedChargePoolIdentifier(
	payload: ChargePoolChangedPayload | null | undefined,
): string | null {
	const previous = payload?.previousValue;
	const next = payload?.newValue;
	if (typeof previous !== 'number' || typeof next !== 'number') return null;
	if (!Number.isFinite(previous) || !Number.isFinite(next) || next <= previous) return null;
	return barePoolIdentifier(payload?.poolId);
}
