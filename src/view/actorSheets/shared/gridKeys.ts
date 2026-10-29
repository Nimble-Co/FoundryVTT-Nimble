/** The grid fills its width, so the columns are the buttons on the first line. */
function columnsOf(buttons: HTMLElement[]): number {
	const top = buttons[0]?.offsetTop ?? 0;
	return Math.max(1, buttons.filter((button) => button.offsetTop === top).length);
}

/** The arrow keys, Home and End move the focus between the buttons of a grid. */
export function moveGridFocus(grid: HTMLElement | undefined, event: KeyboardEvent): void {
	const buttons = [...(grid?.querySelectorAll<HTMLElement>('button') ?? [])];
	const index = buttons.indexOf(event.target as HTMLElement);
	if (index < 0) return;
	const columns = columnsOf(buttons);
	const last = buttons.length - 1;
	const next: Record<string, number> = {
		ArrowRight: Math.min(index + 1, last),
		ArrowLeft: Math.max(index - 1, 0),
		ArrowDown: Math.min(index + columns, last),
		ArrowUp: Math.max(index - columns, 0),
		Home: 0,
		End: last,
	};
	if (!(event.key in next)) return;
	event.preventDefault();
	buttons[next[event.key]]?.focus();
}
