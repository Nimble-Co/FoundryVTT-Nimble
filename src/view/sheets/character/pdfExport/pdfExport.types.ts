import type { jsPDF } from 'jspdf';

// --- Coordinate types ---

export interface TextPosition {
	x: number;
	y: number;
	fontSize: number;
	maxWidth?: number;
}

export interface LinedTextAreaConfig {
	startY: number;
	leftMargin: number;
	columnWidth: number;
	columnGap: number;
	columnCount: number;
	linesPerColumn: number;
	lineHeight: number;
	fontSize: number;
	headerFontSize: number;
	pageHeight: number;
}

export interface SaveArrowPosition {
	upX: number;
	upY: number;
	downX: number;
	downY: number;
	fontSize: number;
}

export interface AdditionalSheetConfig {
	headerTop: number;
	headerHeight: number;
	dividerXs: [number, number, number];
	characterName: TextPosition;
	ancestryClassLevel: TextPosition;
	heightWeightSpeed: TextPosition;
	hitDice: TextPosition;
	linedTextArea: LinedTextAreaConfig;
	logoY: number;
}

export interface PdfCoordinates {
	characterName: TextPosition;
	ancestryClassLevel: TextPosition;
	heightWeightSpeed: TextPosition;
	hitDice: TextPosition;
	hitPoints: TextPosition;
	armor: TextPosition;
	initiative: TextPosition;
	wounds: TextPosition;
	abilities: {
		strength: TextPosition;
		dexterity: TextPosition;
		intelligence: TextPosition;
		will: TextPosition;
	};
	saveArrows: {
		strength: SaveArrowPosition;
		dexterity: SaveArrowPosition;
		intelligence: SaveArrowPosition;
		will: SaveArrowPosition;
	};
	skills: {
		arcana: TextPosition;
		examination: TextPosition;
		finesse: TextPosition;
		influence: TextPosition;
		insight: TextPosition;
		lore: TextPosition;
		might: TextPosition;
		naturecraft: TextPosition;
		perception: TextPosition;
		stealth: TextPosition;
	};
	linedTextArea: LinedTextAreaConfig;
	additionalSheet: AdditionalSheetConfig;
}

// --- HTML parsing types ---

export interface StyledSegment {
	text: string;
	bold: boolean;
	italic: boolean;
}

export interface StyledLine {
	segments: StyledSegment[];
	/** Set for heading elements; drives font-size scaling in the renderer. */
	headerLevel?: 1 | 2 | 3 | 4 | 5 | 6;
	/** Prefix drawn before the line's text (e.g. "• " or "1. "). */
	listMarker?: string;
}

// --- Drawing types ---

export interface DrawStyledTextOptions {
	pdf: jsPDF;
	lines: StyledLine[];
	startX: number;
	startY: number;
	maxWidth: number;
	lineHeight: number;
	fontSize: number;
	maxLines?: number;
}

// --- Export types ---

export type TemplateType = 'lined' | 'noLines';

export interface ExportOptions {
	columnContent: [string, string, string];
	template?: TemplateType;
	lineHeights?: [number, number, number];
	returnPdf?: boolean;
	additionalColumnContent?: [string, string, string];
	additionalLineHeights?: [number, number, number];
}
