const HTML_TAG_PATTERN = /<[^>]*>/g;

export function stripHtml(html: string): string {
	return html.replace(HTML_TAG_PATTERN, '');
}
