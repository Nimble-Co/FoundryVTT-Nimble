/**
 * Sorts documents by name. Generic to avoid circular dependencies.
 */
export default function sortDocumentsByName<T extends { name?: string } | null>(
	documents: (T | null)[],
): T[] {
	return documents
		.filter((doc): doc is T => doc !== null)
		.sort((a, b) => {
			const strippedA = a?.name?.replace(/\(|\)/g, '')?.trim() ?? '';
			const strippedB = b?.name?.replace(/\(|\)/g, '')?.trim() ?? '';

			return strippedA.localeCompare(strippedB);
		});
}
