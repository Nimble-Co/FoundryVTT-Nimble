/** Currency was `{ label, value }` per denomination before it became a plain number. */
export function flattenLegacyCurrency(source: Record<string, any>): void {
	const currency = source.currency;
	if (!currency || typeof currency !== 'object') return;

	for (const [key, entry] of Object.entries(currency)) {
		if (entry && typeof entry === 'object') {
			currency[key] = Number((entry as { value?: unknown }).value) || 0;
		}
	}
}
