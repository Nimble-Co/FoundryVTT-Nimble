import { MigrationBase } from '../MigrationBase.js';

/**
 * Extract price from item description HTML.
 * Looks for patterns like "Cost:</strong> 60 gp" or "Cost: 5 sp"
 */
function extractPriceFromDescription(description: string | undefined): {
	value: number;
	denomination: 'cp' | 'sp' | 'gp';
} | null {
	if (!description) return null;

	// Strip HTML tags for easier matching
	const textOnly = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

	// Match patterns like "Cost: 60 gp" or "Cost: 5 sp"
	const costMatch = textOnly.match(/Cost:?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(gp|sp|cp)/i);
	if (costMatch) {
		const value = parseFloat(costMatch[1].replace(/,/g, ''));
		const denomination = costMatch[2].toLowerCase() as 'cp' | 'sp' | 'gp';
		return { value, denomination };
	}

	return null;
}

/**
 * Migration to add price field to object items.
 *
 * For items of type 'object' that don't have a price field:
 * 1. Attempts to extract price from the description
 * 2. Falls back to default of 0 gp if no price found
 */
class Migration002ItemPrices extends MigrationBase {
	static override readonly version = 2;

	override readonly version = Migration002ItemPrices.version;

	override async updateItem(source: any): Promise<void> {
		// Only process object type items
		if (source.type !== 'object') return;

		// Skip if price already exists
		if (source.system?.price !== undefined) return;

		// Try to extract price from description
		const extractedPrice = extractPriceFromDescription(source.system?.description?.public);

		// Set the price field
		source.system.price = extractedPrice ?? { value: 0, denomination: 'gp' };

		if (extractedPrice) {
			console.log(
				`Nimble Migration | ${source.name}: extracted price ${extractedPrice.value} ${extractedPrice.denomination}`,
			);
		}
	}
}

export { Migration002ItemPrices };
