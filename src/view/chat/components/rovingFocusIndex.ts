/** The arrow keys that move the focus: Up and Down, Left and Right, or all four. */
export type RovingFocusAxis = 'vertical' | 'horizontal' | 'both';

/**
 * The index of the button an arrow key, Home or End moves the focus to, in a
 * row of buttons from 0 to `last`. The arrows wrap at each end. Undefined for
 * any other key.
 */
export function rovingFocusIndex(
	key: string,
	current: number,
	last: number,
	axis: RovingFocusAxis,
): number | undefined {
	if (key === 'Home') return 0;
	if (key === 'End') return last;
	const vertical = axis !== 'horizontal';
	const horizontal = axis !== 'vertical';
	if ((vertical && key === 'ArrowDown') || (horizontal && key === 'ArrowRight')) {
		return current >= last ? 0 : current + 1;
	}
	if ((vertical && key === 'ArrowUp') || (horizontal && key === 'ArrowLeft')) {
		return current <= 0 ? last : current - 1;
	}
	return undefined;
}
