/**
 * Draws styled text segments to a jsPDF document.
 * Handles word wrapping with mixed bold/italic styles.
 */

import type { jsPDF } from 'jspdf';

import type { StyledLine } from './parseHtmlToStyledSegments.ts';

interface DrawStyledTextOptions {
	pdf: jsPDF;
	lines: StyledLine[];
	startX: number;
	startY: number;
	maxWidth: number;
	lineHeight: number;
	fontSize: number;
	maxLines?: number;
}

interface WrappedSegment {
	text: string;
	bold: boolean;
	italic: boolean;
	width: number;
}

/**
 * Get the jsPDF font style string based on bold/italic flags.
 */
function getFontStyle(bold: boolean, italic: boolean): string {
	if (bold && italic) return 'bolditalic';
	if (bold) return 'bold';
	if (italic) return 'italic';
	return 'normal';
}

/**
 * Measure the width of text with specific styling.
 */
function measureText(
	pdf: jsPDF,
	text: string,
	fontSize: number,
	bold: boolean,
	italic: boolean,
): number {
	pdf.setFont('helvetica', getFontStyle(bold, italic));
	pdf.setFontSize(fontSize);
	return pdf.getTextWidth(text);
}

/**
 * Word-wrap a single styled line into multiple output lines.
 * Each output line is an array of segments that fit within maxWidth.
 */
function wrapStyledLine(
	pdf: jsPDF,
	styledLine: StyledLine,
	maxWidth: number,
	fontSize: number,
): WrappedSegment[][] {
	const outputLines: WrappedSegment[][] = [];
	let currentLineSegments: WrappedSegment[] = [];
	let currentLineWidth = 0;
	const spaceWidth = measureText(pdf, ' ', fontSize, false, false);

	for (const segment of styledLine.segments) {
		// Split segment text into words
		const words = segment.text.split(/\s+/).filter((w) => w.length > 0);

		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			const wordWidth = measureText(pdf, word, fontSize, segment.bold, segment.italic);

			// Check if we need a space before this word
			const needsSpace = currentLineSegments.length > 0;
			const totalWidth = currentLineWidth + (needsSpace ? spaceWidth : 0) + wordWidth;

			if (totalWidth > maxWidth && currentLineSegments.length > 0) {
				// Start a new line
				outputLines.push(currentLineSegments);
				currentLineSegments = [];
				currentLineWidth = 0;
			}

			// Add space before word if needed (and we have content on the line)
			if (currentLineSegments.length > 0) {
				// Add space to the previous segment or create a new space segment
				const lastSegment = currentLineSegments[currentLineSegments.length - 1];
				if (lastSegment.bold === segment.bold && lastSegment.italic === segment.italic) {
					// Same styling, append space and word to last segment
					lastSegment.text += ` ${word}`;
					lastSegment.width = measureText(
						pdf,
						lastSegment.text,
						fontSize,
						segment.bold,
						segment.italic,
					);
					currentLineWidth = currentLineSegments.reduce((sum, s) => sum + s.width, 0);
				} else {
					// Different styling, add space to previous segment and new segment for word
					lastSegment.text += ' ';
					lastSegment.width = measureText(
						pdf,
						lastSegment.text,
						fontSize,
						lastSegment.bold,
						lastSegment.italic,
					);
					currentLineSegments.push({
						text: word,
						bold: segment.bold,
						italic: segment.italic,
						width: wordWidth,
					});
					currentLineWidth = currentLineSegments.reduce((sum, s) => sum + s.width, 0);
				}
			} else {
				// First word on the line
				currentLineSegments.push({
					text: word,
					bold: segment.bold,
					italic: segment.italic,
					width: wordWidth,
				});
				currentLineWidth = wordWidth;
			}
		}
	}

	// Push any remaining content
	if (currentLineSegments.length > 0) {
		outputLines.push(currentLineSegments);
	}

	return outputLines;
}

/**
 * Draw styled text to the PDF with word wrapping.
 * Returns the number of lines drawn.
 */
function drawStyledText(options: DrawStyledTextOptions): number {
	const { pdf, lines, startX, startY, maxWidth, lineHeight, fontSize, maxLines } = options;

	let currentY = startY;
	let linesDrawn = 0;

	pdf.setTextColor(0, 0, 0);

	for (const styledLine of lines) {
		// Wrap this line into multiple output lines if needed
		const wrappedLines = wrapStyledLine(pdf, styledLine, maxWidth, fontSize);

		for (const wrappedSegments of wrappedLines) {
			// Check if we've exceeded max lines
			if (maxLines !== undefined && linesDrawn >= maxLines) {
				return linesDrawn;
			}

			// Draw each segment on this line
			let currentX = startX;

			for (const segment of wrappedSegments) {
				pdf.setFont('helvetica', getFontStyle(segment.bold, segment.italic));
				pdf.setFontSize(fontSize);
				pdf.text(segment.text, currentX, currentY);
				currentX += segment.width;
			}

			currentY += lineHeight;
			linesDrawn++;
		}
	}

	return linesDrawn;
}

export { drawStyledText };
export type { DrawStyledTextOptions };
