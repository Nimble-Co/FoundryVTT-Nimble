/**
 * Parses HTML content into styled text segments for PDF rendering.
 * Supports bold (<strong>, <b>) and italic (<em>, <i>) formatting.
 */

interface StyledSegment {
	text: string;
	bold: boolean;
	italic: boolean;
}

interface StyledLine {
	segments: StyledSegment[];
}

/**
 * Parse HTML string into an array of styled lines.
 * Each line contains segments with bold/italic styling information.
 */
function parseHtmlToStyledSegments(html: string): StyledLine[] {
	if (!html || html.trim() === '') {
		return [];
	}

	// Create a temporary element to parse HTML
	const container = document.createElement('div');
	container.innerHTML = html;

	const lines: StyledLine[] = [];
	let currentLine: StyledSegment[] = [];

	function pushCurrentLine(): void {
		if (currentLine.length > 0) {
			lines.push({ segments: currentLine });
			currentLine = [];
		}
	}

	function processNode(node: Node, inheritedBold: boolean, inheritedItalic: boolean): void {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? '';
			if (text) {
				// Split text by newlines
				const parts = text.split(/\n/);
				for (let i = 0; i < parts.length; i++) {
					const part = parts[i];
					if (part) {
						currentLine.push({
							text: part,
							bold: inheritedBold,
							italic: inheritedItalic,
						});
					}
					// Add line break between parts (not after last)
					if (i < parts.length - 1) {
						pushCurrentLine();
					}
				}
			}
			return;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return;
		}

		const element = node as Element;
		const tagName = element.tagName.toLowerCase();

		// Determine styling based on tag
		let bold = inheritedBold;
		let italic = inheritedItalic;

		if (tagName === 'strong' || tagName === 'b') {
			bold = true;
		}
		if (tagName === 'em' || tagName === 'i') {
			italic = true;
		}

		// Handle block elements that create line breaks
		const isBlockElement =
			tagName === 'p' ||
			tagName === 'div' ||
			tagName === 'br' ||
			tagName === 'li' ||
			tagName === 'h1' ||
			tagName === 'h2' ||
			tagName === 'h3' ||
			tagName === 'h4' ||
			tagName === 'h5' ||
			tagName === 'h6';

		// For <br>, just add a line break
		if (tagName === 'br') {
			pushCurrentLine();
			return;
		}

		// Process children
		for (const child of element.childNodes) {
			processNode(child, bold, italic);
		}

		// Add line break after block elements
		if (isBlockElement && currentLine.length > 0) {
			pushCurrentLine();
		}
	}

	// Process all children of the container
	for (const child of container.childNodes) {
		processNode(child, false, false);
	}

	// Push any remaining content
	pushCurrentLine();

	// If no lines were created but there was content, add empty line placeholder
	if (lines.length === 0 && html.trim()) {
		// Plain text without HTML tags
		const text = container.textContent ?? '';
		if (text) {
			const textLines = text.split('\n');
			for (const line of textLines) {
				if (line.trim()) {
					lines.push({
						segments: [{ text: line, bold: false, italic: false }],
					});
				}
			}
		}
	}

	return lines;
}

/**
 * Extract plain text from HTML for character counting.
 */
function getPlainTextFromHtml(html: string): string {
	if (!html) return '';
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.textContent ?? '';
}

export { getPlainTextFromHtml, parseHtmlToStyledSegments };
export type { StyledLine, StyledSegment };
