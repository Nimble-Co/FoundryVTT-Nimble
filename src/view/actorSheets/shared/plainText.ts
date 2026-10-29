const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	'#39': "'",
	apos: "'",
	nbsp: ' ',
};

/** The words of an HTML description, on one line. Enricher links keep their label. */
export function plainText(html: unknown): string {
	if (typeof html !== 'string') return '';
	return html
		.replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
		.replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name])
		.replace(/\s+/g, ' ')
		.trim();
}
