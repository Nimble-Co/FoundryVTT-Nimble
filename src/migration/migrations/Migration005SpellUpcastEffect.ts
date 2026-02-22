import { MigrationBase } from '../MigrationBase.js';

/**
 * Migration to separate upcast descriptions from higher level effect descriptions.
 *
 * Previously, tier 1+ spells stored their upcast text in the `higherLevelEffect`
 * field. This migration moves that content to the new `upcastEffect` field so
 * that spells can independently track:
 * - `higherLevelEffect`: passive scaling as the character gains levels (primarily cantrips)
 * - `upcastEffect`: effects gained by spending additional mana (tier 1+ spells only)
 */
class Migration005SpellUpcastEffect extends MigrationBase {
	static override readonly version = 5;

	override readonly version = Migration005SpellUpcastEffect.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell') return;

		const description = source.system?.description;
		if (!description) return;

		const scalingMode = source.system?.scaling?.mode ?? 'none';
		const higherLevelEffect = description.higherLevelEffect ?? '';
		const existingUpcast = description.upcastEffect ?? '';

		// Only move higherLevelEffect to upcastEffect when the spell actually supports
		// upcasting. Spells with scaling.mode 'none' may have a genuine higher level
		// effect (character-level scaling) that should stay in higherLevelEffect.
		const hasUpcastScaling = scalingMode === 'upcast' || scalingMode === 'upcastChoice';

		if (hasUpcastScaling && higherLevelEffect && !existingUpcast) {
			description.upcastEffect = higherLevelEffect;
			description.higherLevelEffect = '';
			console.log(`Nimble Migration | ${source.name}: moved higherLevelEffect to upcastEffect`);
			return;
		}

		// Ensure the field exists on all spells
		if (description.upcastEffect === undefined) {
			description.upcastEffect = '';
		}
	}
}

export { Migration005SpellUpcastEffect };
