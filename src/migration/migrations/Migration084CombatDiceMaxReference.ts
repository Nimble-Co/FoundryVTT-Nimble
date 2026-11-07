import { MigrationBase } from '../MigrationBase.js';

const OLD_MAX = '@strength + @combatDiceBonus';

/**
 * Fit for Any Battlefield's Combat Dice max read `@combatDiceBonus`, which the
 * roll data never has: the code adds the pool max bonus itself. The reference
 * always counted as 0 and now shows an unknown reference warning, so the max
 * becomes `@strength`, as the pack ships it. Homebrew formulas stay as they are.
 */
class Migration084CombatDiceMaxReference extends MigrationBase {
	static override readonly version = 84;

	override readonly version = Migration084CombatDiceMaxReference.version;

	override async updateItem(source: any): Promise<void> {
		const rules = source?.system?.rules;
		if (!Array.isArray(rules)) return;
		const pool = rules.find(
			(rule: any) => rule?.type === 'chargePool' && rule.id === 'combat-dice-pool',
		);
		if (pool?.max !== OLD_MAX) return;

		pool.max = '@strength';
		console.log(`Nimble Migration | ${source.name}: Combat Dice max`);
	}
}

export { Migration084CombatDiceMaxReference };
