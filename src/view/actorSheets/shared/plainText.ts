const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	'#39': "'",
	apos: "'",
	nbsp: ' ',
};

const BLOCK_END = /<\/(p|div|li|h\d)>|<br\s*\/?>/gi;

/** A block with no end mark gets a full stop, so the blocks read as sentences on one line. */
const endBlock = (text: string) => (/[.!?:;,)]$/.test(text) ? text : `${text}.`);

/** The words of an HTML description, on one line. Enricher links keep their label. */
export function plainText(html: unknown): string {
	if (typeof html !== 'string') return '';
	const blocks = html
		.replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
		.split(BLOCK_END)
		.filter((_, index) => index % 2 === 0)
		.map((block) =>
			block
				.replace(/<[^>]*>/g, '')
				.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name])
				.replace(/\s+/g, ' ')
				.trim(),
		)
		.filter(Boolean);
	return blocks
		.map((block, index) => (index < blocks.length - 1 ? endBlock(block) : block))
		.join(' ');
}
