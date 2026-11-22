const TRAILING_NOTE = /\s*\(([^()]*)\)\s*$/;

/** A label split into its name and a trailing note in brackets, such as "(1/Safe Rest)". */
export function labelNote(label: string): { name: string; note: string | null } {
	const match = TRAILING_NOTE.exec(label);
	const name = match ? label.slice(0, match.index).trim() : label;
	const note = match?.[1]?.trim() ?? '';
	if (!name || !note) return { name: label, note: null };
	return { name, note };
}

/**
 * A pool's sheet heading: its name, with a trailing note in brackets, such as
 * "(1/Safe Rest)", moved to the tooltip.
 */
export function poolHeading(label: string): { name: string; tooltip: string | null } {
	const { name, note } = labelNote(label);
	return note ? { name, tooltip: label } : { name: label, tooltip: null };
}

/** A pool's count: `3/5`, or `3` alone for a pool that hides its maximum. */
export function poolCountText(current: number, max: number, hideMax?: boolean): string {
	return hideMax ? String(current) : `${current}/${max}`;
}
