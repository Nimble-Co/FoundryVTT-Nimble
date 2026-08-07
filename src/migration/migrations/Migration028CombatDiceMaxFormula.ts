import { MigrationBase } from '../MigrationBase.js';

// The max-combat-die item was temporarily granted via grantItem during development of feat/708.
// It has been replaced by the poolMaxBonus mechanism, so any embedded copies are orphaned.
const MAX_COMBAT_DIE_ITEM_ID = 'WnKpJ8RvCb4mX2Qt';

/**
 * Updates the Fit for Any Battlefield class feature on all actors to reflect the
 * feat/708 level-up pool bonus changes:
 *
 * 1. Upgrades the chargePool max formula from `@strength` to
 *    `@strength + @combatDiceBonus` so homebrew formulas can incorporate
 *    the level-up selected bonus directly.
 *
 * 2. Replaces the old `grantItem` rule in the "max-combat-die" levelUpOption
 *    with the new `poolMaxBonus` rule, which stores the +1 in levelUpHistory
 *    rather than embedding a duplicate item.
 *
 * 3. Removes any orphaned "+1 Max Combat Die" items that were granted via the
 *    old grantItem approach during early testing of this feature.
 */
class Migration028CombatDiceMaxFormula extends MigrationBase {
	static override readonly version = 28;

	override readonly version = Migration028CombatDiceMaxFormula.version;

	/** True if this item is Fit for Any Battlefield (matched by its unique chargePool rule id). */
	#isFitForAnyBattlefield(source: Record<string, unknown>): boolean {
		const rules = (source.system as Record<string, unknown> | undefined)?.rules;
		if (!Array.isArray(rules)) return false;
		return rules.some(
			(r: unknown) =>
				r !== null &&
				typeof r === 'object' &&
				(r as Record<string, unknown>).type === 'chargePool' &&
				(r as Record<string, unknown>).id === 'combat-dice-pool',
		);
	}

	/** True if this item is the legacy "+1 Max Combat Die" granted item. */
	#isOrphanedMaxCombatDie(source: Record<string, unknown>): boolean {
		const compendiumSource =
			(source._stats as Record<string, unknown> | undefined)?.compendiumSource ?? '';
		const coreFlags = ((source.flags as Record<string, unknown> | undefined)?.core ?? {}) as Record<
			string,
			unknown
		>;
		const legacySourceId = coreFlags.sourceId ?? '';
		return (
			(typeof compendiumSource === 'string' && compendiumSource.includes(MAX_COMBAT_DIE_ITEM_ID)) ||
			(typeof legacySourceId === 'string' && legacySourceId.includes(MAX_COMBAT_DIE_ITEM_ID))
		);
	}

	override async updateActor(source: Record<string, unknown>): Promise<void> {
		const items = source.items;
		if (!Array.isArray(items)) return;

		const before = items.length;
		source.items = items.filter(
			(item: unknown) => !this.#isOrphanedMaxCombatDie(item as Record<string, unknown>),
		);

		const removed = before - (source.items as unknown[]).length;
		if (removed > 0) {
			console.log(
				`Nimble Migration | ${source.name ?? 'Actor'}: removed ${removed} orphaned "+1 Max Combat Die" item(s)`,
			);
		}
	}

	override async updateItem(source: Record<string, unknown>): Promise<void> {
		if (source.type !== 'feature') return;
		if (!this.#isFitForAnyBattlefield(source)) return;

		const system = source.system as Record<string, unknown>;

		// 1. Update chargePool max formula
		const rules = system.rules as Record<string, unknown>[];
		const chargePoolRule = rules.find(
			(r) => r.type === 'chargePool' && r.id === 'combat-dice-pool',
		);
		if (chargePoolRule && chargePoolRule.max !== '@strength + @combatDiceBonus') {
			chargePoolRule.max = '@strength + @combatDiceBonus';
			console.log(
				`Nimble Migration | ${source.name ?? 'feature'}: updated combat dice chargePool max formula`,
			);
		}

		// 2. Replace grantItem with poolMaxBonus in the max-combat-die levelUpOption
		const levelUpOptions = system.levelUpOptions;
		if (!Array.isArray(levelUpOptions)) return;

		const maxCombatDieOption = levelUpOptions.find(
			(o: Record<string, unknown>) => o.id === 'max-combat-die',
		) as Record<string, unknown> | undefined;
		if (!maxCombatDieOption) return;

		const optionRules = maxCombatDieOption.rules;
		if (!Array.isArray(optionRules)) return;

		const hasGrantItem = optionRules.some(
			(r: Record<string, unknown>) =>
				r.type === 'grantItem' &&
				typeof r.uuid === 'string' &&
				r.uuid.includes(MAX_COMBAT_DIE_ITEM_ID),
		);
		const hasPoolMaxBonus = optionRules.some(
			(r: Record<string, unknown>) => r.type === 'poolMaxBonus',
		);

		if (hasGrantItem && !hasPoolMaxBonus) {
			// Replace the grantItem rule in place, preserving any sibling rules the option carries.
			maxCombatDieOption.rules = optionRules.map((r: Record<string, unknown>) =>
				r.type === 'grantItem' &&
				typeof r.uuid === 'string' &&
				r.uuid.includes(MAX_COMBAT_DIE_ITEM_ID)
					? {
							type: 'poolMaxBonus',
							poolIdentifier: 'combat-dice',
							amount: 1,
							grantItemUuid: `Compendium.nimble.nimble-class-features.Item.${MAX_COMBAT_DIE_ITEM_ID}`,
						}
					: r,
			);
			console.log(
				`Nimble Migration | ${source.name ?? 'feature'}: replaced grantItem with poolMaxBonus in max-combat-die levelUpOption`,
			);
		}
	}
}

export { Migration028CombatDiceMaxFormula };
