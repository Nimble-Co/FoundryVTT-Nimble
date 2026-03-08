import { MigrationBase } from '../MigrationBase.js';

const RAZOR_WIND_SOURCE_ID = 'Compendium.nimble.spells.Item.N9DAEOBnY6QyW7VM';

/**
 * Migration to add the vicious property to Razor Wind spells.
 *
 * Razor Wind has the Vicious property (roll 1 additional die on crit),
 * but existing items in the database don't have it in their properties.selected array.
 */
class Migration010RazorWindVicious extends MigrationBase {
	static override readonly version = 10;

	override readonly version = Migration010RazorWindVicious.version;

	override async updateItem(source: any): Promise<void> {
		// Only process spell items
		if (source.type !== 'spell') return;

		const sourceId = source.flags?.core?.sourceId;
		const name = source.name;

		// Handle Razor Wind
		if (sourceId === RAZOR_WIND_SOURCE_ID || name === 'Razor Wind') {
			this.#ensurePropertiesSelected(source);
			if (!source.system.properties.selected.includes('vicious')) {
				source.system.properties.selected.push('vicious');
				console.log(`Nimble Migration | ${name}: added vicious property`);
			}
		}
	}

	#ensurePropertiesSelected(source: any): void {
		if (!source.system.properties) {
			source.system.properties = {};
		}
		if (!source.system.properties.selected) {
			source.system.properties.selected = [];
		}
	}
}

export { Migration010RazorWindVicious };
