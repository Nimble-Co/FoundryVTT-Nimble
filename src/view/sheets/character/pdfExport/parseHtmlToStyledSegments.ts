/**
 * Parses HTML content into styled text segments for PDF rendering.
 * Supports bold (<strong>, <b>), italic (<em>, <i>), headings (<h1>–<h3>),
 * unordered lists (<ul>/<li>), and ordered lists (<ol>/<li>).
 */

interface StyledSegment {
	text: string;
	bold: boolean;
	italic: boolean;
}

interface StyledLine {
	segments: StyledSegment[];
	/** Set for heading elements; drives font-size scaling in the renderer. */
	headerLevel?: 1 | 2 | 3 | 4 | 5 | 6;
	/** Prefix drawn before the line's text (e.g. "• " or "1. "). */
	listMarker?: string;
}

/**
 * Parse HTML string into an array of styled lines.
 * Each line carries segments with bold/italic flags, plus optional
 * headerLevel and listMarker metadata.
 */
function parseHtmlToStyledSegments(html: string): StyledLine[] {
	if (!html || html.trim() === '') {
		return [];
	}

	const container = document.createElement('div');
	container.innerHTML = html;

	const lines: StyledLine[] = [];
	let currentLine: StyledSegment[] = [];
	let currentLineMeta: { headerLevel?: 1 | 2 | 3 | 4 | 5 | 6; listMarker?: string } = {};

	function pushCurrentLine(): void {
		if (currentLine.length > 0) {
			lines.push({ segments: currentLine, ...currentLineMeta });
			currentLine = [];
		}
		currentLineMeta = {};
	}

	function processNode(
		node: Node,
		inheritedBold: boolean,
		inheritedItalic: boolean,
		listCtx?: { type: 'ul' | 'ol'; counter: { value: number } } | null,
	): void {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? '';
			if (text) {
				const parts = text.split(/\n/);
				for (let i = 0; i < parts.length; i++) {
					const part = parts[i];
					if (part) {
						currentLine.push({ text: part, bold: inheritedBold, italic: inheritedItalic });
					}
					if (i < parts.length - 1) pushCurrentLine();
				}
			}
			return;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const element = node as Element;
		const tagName = element.tagName.toLowerCase();

		let bold = inheritedBold;
		let italic = inheritedItalic;

		if (tagName === 'strong' || tagName === 'b') bold = true;
		if (tagName === 'em' || tagName === 'i') italic = true;

		// --- Headings ---
		if (/^h[1-6]$/.test(tagName)) {
			const level = parseInt(tagName[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
			pushCurrentLine(); // flush anything before the heading
			currentLineMeta.headerLevel = level;
			for (const child of element.childNodes) {
				processNode(child, true, italic, listCtx);
			}
			pushCurrentLine();
			return;
		}

		// --- Unordered list ---
		if (tagName === 'ul') {
			const ulCtx = { type: 'ul' as const, counter: { value: 0 } };
			for (const child of element.childNodes) {
				processNode(child, bold, italic, ulCtx);
			}
			return;
		}

		// --- Ordered list ---
		if (tagName === 'ol') {
			const olCtx = { type: 'ol' as const, counter: { value: 0 } };
			for (const child of element.childNodes) {
				processNode(child, bold, italic, olCtx);
			}
			return;
		}

		// --- List item ---
		if (tagName === 'li') {
			pushCurrentLine(); // flush any text before this item
			if (listCtx?.type === 'ol') {
				listCtx.counter.value++;
				currentLineMeta.listMarker = `${listCtx.counter.value}. `;
			} else {
				currentLineMeta.listMarker = '• '; // •
			}
			for (const child of element.childNodes) {
				processNode(child, bold, italic, listCtx);
			}
			pushCurrentLine();
			return;
		}

		// --- Line break ---
		if (tagName === 'br') {
			pushCurrentLine();
			return;
		}

		// --- Generic block elements ---
		const isBlock = tagName === 'p' || tagName === 'div';

		for (const child of element.childNodes) {
			processNode(child, bold, italic, listCtx);
		}

		if (isBlock && currentLine.length > 0) pushCurrentLine();
	}

	for (const child of container.childNodes) {
		processNode(child, false, false);
	}

	pushCurrentLine();

	// Fallback for plain text without HTML tags
	if (lines.length === 0 && html.trim()) {
		const text = container.textContent ?? '';
		if (text) {
			for (const line of text.split('\n')) {
				if (line.trim()) {
					lines.push({ segments: [{ text: line, bold: false, italic: false }] });
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
