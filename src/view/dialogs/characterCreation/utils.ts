/**
 * Checks if a background is a "Raised by" background that requires ancestry selection.
 */
export function isRaisedByBackground(background: NimbleBackgroundItem | null): boolean {
	return background?.name?.toLowerCase().includes('raised by') ?? false;
}
