import localize from '#utils/localize.js';

/** A document name that a card shows, with the uuid of the document when it is known. */
export interface DocLink {
	name: string;
	uuid?: string | null;
}

/** One piece of a sentence: plain text, or a document name. */
export type LinkedPart = string | DocLink;

/** The value of a placeholder: text, a number, a document name, or pieces of a sentence. */
export type LinkedValue = string | number | DocLink | readonly LinkedPart[] | null | undefined;

export type LinkedData = Record<string, LinkedValue>;

/** The document a name opens, with what its anchor carries. */
export interface LinkedDocument {
	uuid: string;
	id?: string | null;
	documentName?: string;
	pack?: string | null;
}

interface LinkCandidate extends Partial<LinkedDocument> {
	type?: string;
	system?: { identified?: boolean };
	testUserPermission?(user: unknown, level: string): boolean;
}

export function isDocLink(value: unknown): value is DocLink {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as DocLink).name === 'string'
	);
}

/** A document name with its uuid, or with none when the uuid is empty. */
export function docLink(name: string | null | undefined, uuid?: string | null): DocLink {
	return uuid ? { name: name ?? '', uuid } : { name: name ?? '' };
}

function partsOf(value: LinkedValue): LinkedPart[] {
	if (value === null || value === undefined) return [];
	if (typeof value === 'string') return [value];
	if (typeof value === 'number') return [String(value)];
	if (Array.isArray(value)) return [...value];
	return [value as DocLink];
}

/** Text pieces next to each other become one; empty pieces go. */
function joined(parts: readonly LinkedPart[]): LinkedPart[] {
	const out: LinkedPart[] = [];
	for (const part of parts) {
		if (part === '') continue;
		const last = out.at(-1);
		if (typeof part === 'string' && typeof last === 'string') out[out.length - 1] = last + part;
		else out.push(part);
	}
	return out;
}

/** A localized sentence split at its placeholders, so a document name in it can be a link. */
export function linkedParts(key: string, data: LinkedData = {}): LinkedPart[] {
	return joined(
		localize(key)
			.split(/\{(\w+)\}/)
			.flatMap((piece, index) => (index % 2 === 0 ? [piece] : partsOf(data[piece]))),
	);
}

/** The pieces as plain text, for an aria-label, a tooltip or a button. */
export function partsText(parts: readonly LinkedPart[]): string {
	return parts.map((part) => (typeof part === 'string' ? part : part.name)).join('');
}

/** The plain text twin of `linkedParts`. */
export function linkedText(key: string, data: LinkedData = {}): string {
	return partsText(linkedParts(key, data));
}

/**
 * The document a name links to: it exists on this client and the user may see it. Null when the
 * name stays plain text, and always for an object that is not identified.
 */
export function linkedDocument(link: DocLink): LinkedDocument | null {
	if (!link.uuid) return null;
	let found: LinkCandidate | null;
	try {
		found = fromUuidSync(link.uuid as Parameters<typeof fromUuidSync>[0], {
			strict: false,
		}) as LinkCandidate | null;
	} catch {
		return null;
	}
	if (!found?.uuid || typeof found.testUserPermission !== 'function') return null;
	if (!game.user || !found.testUserPermission(game.user, 'LIMITED')) return null;
	if (
		found.documentName === 'Item' &&
		found.type === 'object' &&
		found.system?.identified === false
	)
		return null;
	return { uuid: found.uuid, id: found.id, documentName: found.documentName, pack: found.pack };
}
