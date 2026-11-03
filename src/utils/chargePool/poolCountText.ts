/** A pool's count: `3/5`, or `3` alone for a pool that hides its maximum. */
export function poolCountText(current: number, max: number, hideMax?: boolean): string {
	return hideMax ? String(current) : `${current}/${max}`;
}
