import { SvelteMap } from 'svelte/reactivity';

/** The open tag of each tag row, by message id and row: a card renders again on every update. */
const openTags = new SvelteMap<string, string>();

/** Which tag of a row shows its sentence under the row. One tag per row is open. */
export function createTagNotes(messageId: string) {
	const key = (row: string) => `${messageId}:${row}`;
	return {
		openTag: (row: string): string | null => openTags.get(key(row)) ?? null,
		toggle(row: string, tag: string) {
			const rowKey = key(row);
			if (openTags.get(rowKey) === tag) openTags.delete(rowKey);
			else openTags.set(rowKey, tag);
		},
	};
}
