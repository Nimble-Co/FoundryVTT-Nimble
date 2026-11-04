const TRAILING_NOTE = /\s*\([^()]*\)\s*$/;

/**
 * A pool's sheet heading: its name, with a trailing note in brackets, such as
 * "(1/Safe Rest)", moved to the tooltip.
 */
export function poolHeading(label: string): { name: string; tooltip: string | null } {
	const name = label.replace(TRAILING_NOTE, '').trim();
	if (!name || name === label) return { name: label, tooltip: null };
	return { name, tooltip: label };
}

/** A pool's count: `3/5`, or `3` alone for a pool that hides its maximum. */
export function poolCountText(current: number, max: number, hideMax?: boolean): string {
	return hideMax ? String(current) : `${current}/${max}`;
}
