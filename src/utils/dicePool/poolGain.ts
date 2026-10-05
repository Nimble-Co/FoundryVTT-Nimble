export interface PoolChangedPayload {
	poolId?: string;
	previousFaces?: number[];
	newFaces?: number[];
	reason?: string;
}

/**
 * The identifier of the pool a pool-changed event added dice to, or null when
 * the event is no gain: the pool holds no more dice than before, or spent dice
 * were refunded. Actor-scoped pool ids carry an "actor:" prefix; rules name the
 * bare identifier in both scopes.
 */
export function gainedPoolIdentifier(
	payload: PoolChangedPayload | null | undefined,
): string | null {
	if (!payload || payload.reason === 'refund') return null;
	if ((payload.newFaces?.length ?? 0) <= (payload.previousFaces?.length ?? 0)) return null;
	const poolId = payload.poolId ?? '';
	return poolId.startsWith('actor:') ? poolId.slice('actor:'.length) : poolId;
}
