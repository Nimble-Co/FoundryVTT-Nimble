export default function sortItems<T extends Item>(items: T[]): T[] {
	return items.sort((a, b) => a.sort - b.sort);
}
