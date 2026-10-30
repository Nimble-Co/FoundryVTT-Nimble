/**
 * True for an Escape key, which it keeps from the window: Foundry opens its
 * main menu on an Escape that reaches it.
 */
export function claimEscape(event: KeyboardEvent): boolean {
	if (event.key !== 'Escape') return false;
	event.preventDefault();
	event.stopPropagation();
	return true;
}
