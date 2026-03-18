import { MigrationBase } from '../MigrationBase.js';

const VICIOUS_ITEM_SOURCE_IDS = new Set([
	'Compendium.nimble.weapons.Item.YjGUoWybYcwxI2Ky', // Sling
	'Compendium.nimble.weapons.Item.XsT9DWdPp0ZhnOZR', // Sickle
	'Compendium.nimble.spells.Item.N9DAEOBnY6QyW7VM', // Razor Wind
]);

/**
 * Migration to remove the vicious explosion damage effect from vicious weapons and spells.
 *
 * The vicious property now handles explosion dice automatically via the damage
 * calculation system rather than as a separate effect in the activation tree.
 */
class Migration012ViciousExplosionDamage extends MigrationBase {
	static override readonly version = 12;

	override readonly version = Migration012ViciousExplosionDamage.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'object' && source.type !== 'spell') return;

		const sourceId = source.flags?.core?.sourceId;
		if (!sourceId || !VICIOUS_ITEM_SOURCE_IDS.has(sourceId)) return;

		const effects = source.system?.activation?.effects;
		if (!Array.isArray(effects)) return;

		for (const effect of effects) {
			const criticalHitEffects = effect?.on?.criticalHit;
			if (!Array.isArray(criticalHitEffects)) continue;

			const originalLength = criticalHitEffects.length;

			// Remove vicious explosion damage effects (damage with ignoreArmor on crit)
			effect.on.criticalHit = criticalHitEffects.filter(
				(e: any) => !(e.type === 'damage' && e.parentContext === 'criticalHit' && e.ignoreArmor),
			);

			if (effect.on.criticalHit.length < originalLength) {
				console.log(`Nimble Migration | ${source.name}: removed vicious explosion damage effect`);
			}
		}
	}
}

export { Migration012ViciousExplosionDamage };
