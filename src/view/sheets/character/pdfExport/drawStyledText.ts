/**
 * Draws styled text segments to a jsPDF document.
 * Handles word wrapping with mixed bold/italic styles, heading levels,
 * and list markers.
 */

import type { jsPDF } from 'jspdf';

import type { DrawStyledTextOptions, StyledSegment } from './pdfExport.types.ts';

interface WrappedSegment {
	text: string;
	bold: boolean;
	italic: boolean;
	width: number;
}

/** Font-size multipliers for each heading level relative to body fontSize. */
const HEADER_SCALES: Record<number, number> = {
	1: 1.5,
	2: 1.33,
	3: 1.17,
	4: 1.1,
	5: 1.1,
	6: 1.1,
};

function getFontStyle(bold: boolean, italic: boolean): string {
	if (bold && italic) return 'bolditalic';
	if (bold) return 'bold';
	if (italic) return 'italic';
	return 'normal';
}

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
	styledLine: { segments: StyledSegment[] },
	maxWidth: number,
	fontSize: number,
): WrappedSegment[][] {
	const outputLines: WrappedSegment[][] = [];
	let currentLineSegments: WrappedSegment[] = [];
	let currentLineWidth = 0;
	const spaceWidth = measureText(pdf, ' ', fontSize, false, false);

	for (const segment of styledLine.segments) {
		const words = segment.text.split(/\s+/).filter((w) => w.length > 0);

		for (const word of words) {
			const wordWidth = measureText(pdf, word, fontSize, segment.bold, segment.italic);
			const needsSpace = currentLineSegments.length > 0;
			const totalWidth = currentLineWidth + (needsSpace ? spaceWidth : 0) + wordWidth;

			if (totalWidth > maxWidth && currentLineSegments.length > 0) {
				outputLines.push(currentLineSegments);
				currentLineSegments = [];
				currentLineWidth = 0;
			}

			if (currentLineSegments.length > 0) {
				const lastSegment = currentLineSegments[currentLineSegments.length - 1];
				if (lastSegment.bold === segment.bold && lastSegment.italic === segment.italic) {
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

	if (currentLineSegments.length > 0) outputLines.push(currentLineSegments);

	return outputLines;
}

/**
 * Draw styled text to the PDF with word wrapping.
 * Headings render at scaled font sizes; list items are prefixed with their marker.
 * Returns the number of output lines drawn.
 */
function drawStyledText(options: DrawStyledTextOptions): number {
	const { pdf, lines, startX, startY, maxWidth, lineHeight, fontSize, maxLines } = options;

	let currentY = startY;
	let linesDrawn = 0;

	pdf.setTextColor(0, 0, 0);

	for (const styledLine of lines) {
		// Resolve font size for this line
		const lineFontSize =
			styledLine.headerLevel !== undefined
				? Math.round(fontSize * (HEADER_SCALES[styledLine.headerLevel] ?? 1))
				: fontSize;

		// Build segments: prepend list marker, apply heading bold
		let segments: StyledSegment[] = styledLine.segments;

		if (styledLine.listMarker) {
			segments = [{ text: styledLine.listMarker, bold: false, italic: false }, ...segments];
		}

		if (styledLine.headerLevel !== undefined) {
			segments = segments.map((s) => ({ ...s, bold: true }));
		}

		const wrappedLines = wrapStyledLine(pdf, { segments }, maxWidth, lineFontSize);
		// Headers use the same line height as body text — they just render larger/bolder
		// without disturbing the vertical rhythm of the PDF grid
		const scaledLineHeight =
			styledLine.headerLevel !== undefined ? lineHeight : lineHeight * (lineFontSize / fontSize);

		for (const wrappedSegments of wrappedLines) {
			if (maxLines !== undefined && linesDrawn >= maxLines) return linesDrawn;

			let currentX = startX;
			for (const segment of wrappedSegments) {
				pdf.setFont('helvetica', getFontStyle(segment.bold, segment.italic));
				pdf.setFontSize(lineFontSize);
				pdf.text(segment.text, currentX, currentY);
				currentX += segment.width;
			}

			currentY += scaledLineHeight;
			linesDrawn++;
		}
	}

	return linesDrawn;
}

export { drawStyledText };
