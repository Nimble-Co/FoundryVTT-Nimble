import { pdfCoordinates } from '../sheets/character/pdfExport/pdfCoordinates.ts';

/** Ability columns, left-to-right, as they appear on the sheet. */
export const ABILITY_KEYS = ['strength', 'dexterity', 'intelligence', 'will'] as const;

/** Skill rows, in sheet order. */
export const SKILL_KEYS = [
	'arcana',
	'examination',
	'finesse',
	'influence',
	'insight',
	'lore',
	'might',
	'naturecraft',
	'perception',
	'stealth',
] as const;

/** Main-sheet lined text area config. */
export const col = pdfCoordinates.linedTextArea;

/** Additional-sheet config. */
export const add = pdfCoordinates.additionalSheet;

/** Additional column height: same bottom as main sheet columns, starting from add column startY */
export const addColBaseHeight =
	col.startY + col.linesPerColumn * col.lineHeight + 28 - add.linedTextArea.startY;

/** Convert PDF (x, y, fontSize) to an absolute CSS `style` string.
 *  Center-aligned (no maxWidth): centers element at x via translateX(-50%).
 *  Left-aligned (with maxWidth): anchors left edge at x. */
export function ts(x: number, y: number, fs: number, bold = false, mw?: number): string {
	const top = y - fs * 0.75;
	const weight = bold ? 'font-weight:bold;' : '';
	if (mw) {
		return `left:${x}px;top:${top}px;font-size:${fs}px;${weight}max-width:${mw}px;white-space:normal;`;
	}
	return `left:${x}px;top:${top}px;font-size:${fs}px;${weight}transform:translateX(-50%);white-space:nowrap;`;
}
