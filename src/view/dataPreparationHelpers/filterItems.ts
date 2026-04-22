import type { NimbleCharacter } from '../../documents/actor/character.js';
import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';

const HTML_TAG_PATTERN = /<[^>]*>/g;

function stripHtml(html: string): string {
	return html.replace(HTML_TAG_PATTERN, '');
}

/** Description can be a plain HTML string, an object with string fields, or absent. */
type ItemDescription = string | Record<string, string> | null | undefined;

function getDescriptionText(description: ItemDescription): string {
	if (typeof description === 'string') return stripHtml(description);
	if (typeof description === 'object' && description !== null) {
		return Object.values(description)
			.filter((v): v is string => typeof v === 'string')
			.map(stripHtml)
			.join(' ');
	}
	return '';
}

export default function filterItems(
	actor: NimbleCharacter,
	requiredItemTypes: string[] | string,
	searchTerm: string,
): NimbleBaseItem[] {
	const types = Array.isArray(requiredItemTypes) ? requiredItemTypes : [requiredItemTypes];
	return actor.items.filter((item) => {
		if (!types.includes(item.type)) return false;
		if (!searchTerm) return true;

		const term = searchTerm.toLocaleLowerCase();
		if (item.name.toLocaleLowerCase().includes(term)) return true;

		const system = item.system as { description?: ItemDescription };
		const descriptionText = getDescriptionText(system.description);
		return descriptionText.toLocaleLowerCase().includes(term);
	}) as NimbleBaseItem[];
}
