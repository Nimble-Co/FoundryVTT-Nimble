import { MigrationBase } from '../MigrationBase.js';

const SEARING_LIGHT_SOURCE_ID = 'Compendium.nimble.class-features.Item.KQiBYDr1BBTE0iJq';

/**
 * Migration to add targetDisposition to Searing Light's activation effects.
 *
 * The healing effect should only surface for friendly targets, and the damage
 * effect should only surface for hostile targets. This lets the chat card hide
 * the irrelevant button based on the disposition of the selected token.
 */
class Migration019SearingLightDisposition extends MigrationBase {
	static override readonly version = 19;

	override readonly version = Migration019SearingLightDisposition.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const sourceId = this.getSourceId(source);
		const name = source.name;

		if (sourceId !== SEARING_LIGHT_SOURCE_ID && name !== 'Searing Light') return;

		const effects = source.system?.activation?.effects;
		if (!Array.isArray(effects)) return;

		for (const effect of effects) {
			if (effect.id === 'SearingLightHealing1' && !effect.targetDisposition) {
				effect.targetDisposition = 'friendly';
			}
			if (effect.id === 'SearingLightDamage1' && !effect.targetDisposition) {
				effect.targetDisposition = 'hostile';
			}
		}
	}
}

export { Migration019SearingLightDisposition };
