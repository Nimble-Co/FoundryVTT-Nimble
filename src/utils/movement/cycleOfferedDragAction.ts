/**
 * The movement action a drag switches to when its token carries a Movement
 * Offer and the user presses the cycle key. The key goes round one ring: the
 * offered movement, then each movement action core cycles through, and back to
 * the offer. Null stands for the offered movement. An action that is not in the
 * ring counts as the offer, as core counts it as before its first action.
 */
export function cycleOfferedDragAction(
	actions: readonly string[],
	current: string | null,
	reverse: boolean,
): string | null {
	const ring: (string | null)[] = [null, ...actions];
	const index = Math.max(0, ring.indexOf(current));
	return ring[(index + (reverse ? -1 : 1) + ring.length) % ring.length];
}
