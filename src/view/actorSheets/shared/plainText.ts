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

const SENTENCE_END = /[.!?][”"’')\]]*(?=\s|$)/g;
const ABBREVIATION = /(?:^|[\s(])(?:pg|req|e\.g|i\.e|vs)\.$/i;

function sentences(text: string): string[] {
	const found: string[] = [];
	let start = 0;
	for (const match of text.matchAll(SENTENCE_END)) {
		if (ABBREVIATION.test(text.slice(start, match.index + 1))) continue;
		const end = match.index + match[0].length;
		found.push(text.slice(start, end).trim());
		start = end;
	}
	found.push(text.slice(start).trim());
	return found.filter(Boolean);
}

/** The first sentence of a plain text. A first sentence that only repeats `name` is skipped. */
export function firstSentence(text: string, name = ''): string {
	const [first = '', second = ''] = sentences(text);
	const repeatsName =
		name &&
		first
			.replace(/[.!?]+$/, '')
			.trim()
			.toLowerCase() === name.trim().toLowerCase();
	return repeatsName ? second : first;
}
