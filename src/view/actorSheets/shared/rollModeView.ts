import type { Format } from './sheetSource.ts';

export interface RollModeView {
	/** stacked advantage (positive) or disadvantage (negative) */
	value: number;
	label: string;
}

/** The roll mode that rules give to a roll; null when they give none. */
export function rollModeView(value: number, format: Format): RollModeView | null {
	if (!value) return null;
	const kind = value > 0 ? 'advantage' : 'disadvantage';
	return {
		value,
		label: format(`NIMBLE.actorSheet.parts.rollMode.${kind}`, { count: String(Math.abs(value)) }),
	};
}
