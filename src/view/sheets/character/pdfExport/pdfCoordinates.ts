/**
 * PDF coordinates for the character sheet template.
 *
 * Template dimensions: 4960 x 6418 pixels
 * Target PDF: Letter size (612 x 792 points)
 *
 * Coordinate system: Uses top-left origin (jsPDF native).
 * All coordinates are in PDF points.
 */

/** Template width in pixels */
const TEMPLATE_WIDTH = 4960;

/** Template height in pixels */
const TEMPLATE_HEIGHT = 6418;

/** PDF page width in points */
const PDF_WIDTH = 612;

/** PDF page height in points */
const PDF_HEIGHT = 792;

/** Scale factor to convert pixel coordinates to PDF points */
const SCALE_X = PDF_WIDTH / TEMPLATE_WIDTH;
const SCALE_Y = PDF_HEIGHT / TEMPLATE_HEIGHT;

/** Convert pixel X to PDF X coordinate */
function pdfX(pixelX: number): number {
	return pixelX * SCALE_X;
}

/** Convert pixel Y to PDF Y coordinate (top-left origin) */
function pdfY(pixelY: number): number {
	return pixelY * SCALE_Y;
}

/** Convert pixel width to PDF width */
function pdfW(pixelW: number): number {
	return pixelW * SCALE_X;
}

interface TextPosition {
	x: number;
	y: number;
	fontSize: number;
	maxWidth?: number;
}

interface LinedTextAreaConfig {
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

interface SaveArrowPosition {
	upX: number;
	upY: number;
	downX: number;
	downY: number;
	fontSize: number;
}

interface PdfCoordinates {
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
}

/**
 * Coordinates for placing text on the PDF character sheet.
 * Values measured from CharacterSheet-Full.png template (4960 x 6418 pixels).
 * Calibrated based on user feedback.
 */
const pdfCoordinates: PdfCoordinates = {
	// Header row - adjusted -3px up from previous
	characterName: {
		x: pdfX(167),
		y: pdfY(213),
		fontSize: 11,
		maxWidth: pdfW(550),
	},
	ancestryClassLevel: {
		x: pdfX(1300),
		y: pdfY(213),
		fontSize: 8,
		maxWidth: pdfW(850),
	},
	heightWeightSpeed: {
		x: pdfX(2840),
		y: pdfY(213),
		fontSize: 8,
		maxWidth: pdfW(1400),
	},
	hitDice: {
		x: pdfX(4650),
		y: pdfY(213),
		fontSize: 10,
	},

	// HP box - up 5px, right 5px
	hitPoints: {
		x: pdfX(2606),
		y: pdfY(634),
		fontSize: 14,
	},

	// Combat stats - armor/initiative same font as stats, right 5px
	armor: {
		x: pdfX(2980),
		y: pdfY(837),
		fontSize: 18,
	},
	initiative: {
		x: pdfX(3372),
		y: pdfY(837),
		fontSize: 18,
	},
	// Wounds right 2px total
	wounds: {
		x: pdfX(4481),
		y: pdfY(898),
		fontSize: 12,
	},

	// Ability scores - left 5px
	abilities: {
		strength: {
			x: pdfX(553),
			y: pdfY(764),
			fontSize: 18,
		},
		dexterity: {
			x: pdfX(1007),
			y: pdfY(764),
			fontSize: 18,
		},
		intelligence: {
			x: pdfX(1477),
			y: pdfY(764),
			fontSize: 18,
		},
		will: {
			x: pdfX(1947),
			y: pdfY(764),
			fontSize: 18,
		},
	},

	// Save advantage/disadvantage arrows (above/below ability scores)
	saveArrows: {
		strength: {
			upX: pdfX(572),
			upY: pdfY(504),
			downX: pdfX(572),
			downY: pdfY(1070),
			fontSize: 12,
		},
		dexterity: {
			upX: pdfX(1027),
			upY: pdfY(504),
			downX: pdfX(1027),
			downY: pdfY(1070),
			fontSize: 12,
		},
		intelligence: {
			upX: pdfX(1482),
			upY: pdfY(504),
			downX: pdfX(1482),
			downY: pdfY(1070),
			fontSize: 12,
		},
		will: {
			upX: pdfX(1939),
			upY: pdfY(504),
			downX: pdfX(1939),
			downY: pdfY(1070),
			fontSize: 12,
		},
	},

	// Skills row - up 10px
	skills: {
		arcana: {
			x: pdfX(579),
			y: pdfY(1450),
			fontSize: 12,
		},
		examination: {
			x: pdfX(999),
			y: pdfY(1450),
			fontSize: 12,
		},
		finesse: {
			x: pdfX(1419),
			y: pdfY(1450),
			fontSize: 12,
		},
		influence: {
			x: pdfX(1839),
			y: pdfY(1450),
			fontSize: 12,
		},
		insight: {
			x: pdfX(2259),
			y: pdfY(1450),
			fontSize: 12,
		},
		lore: {
			x: pdfX(2679),
			y: pdfY(1450),
			fontSize: 12,
		},
		might: {
			x: pdfX(3099),
			y: pdfY(1450),
			fontSize: 12,
		},
		naturecraft: {
			x: pdfX(3519),
			y: pdfY(1450),
			fontSize: 12,
		},
		perception: {
			x: pdfX(3939),
			y: pdfY(1450),
			fontSize: 12,
		},
		stealth: {
			x: pdfX(4359),
			y: pdfY(1450),
			fontSize: 12,
		},
	},

	// Lined text area for features, spells, and inventory (3 columns, 23 lines each)
	linedTextArea: {
		startY: 238,
		leftMargin: 21,
		columnWidth: 190,
		columnGap: 5,
		columnCount: 3,
		linesPerColumn: 23,
		lineHeight: 22,
		fontSize: 6,
		headerFontSize: 7,
		pageHeight: 792,
	},
};

export { pdfCoordinates };
export type { LinedTextAreaConfig, PdfCoordinates, TextPosition };
