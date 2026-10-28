export default function sortItems(items: Item[]): Item[] {
	return items.sort((a, b) => a.sort - b.sort);
}
