import { MigrationBase } from '../MigrationBase.js';

const RADIANT_JUDGEMENT_SOURCE_ID = 'Compendium.nimble.class-features.Item.qiQeJrIxla9y6XY0';
const JUDGMENT_POOL_RULE_ID = 'judgment-pool-base';

/**
 * Migrates the Oathsworn Radiant Judgement refill from `mode: "set"` / `value: "2"`
 * to `mode: "setIfEmpty"` / `value: "@poolMax"`.
 *
 * Rationale (rulebook: "if you have no Judgment Dice, roll your Judgment dice"):
 * - `set` re-rolled the pool every onAttacked even when dice were already live.
 * - The hard-coded `2` ignored the L14 "roll 1 more" modifier, so refills at L14
 *   only ever produced 2 dice instead of 3. `@poolMax` resolves against the
 *   per-actor pool max so L1 still rolls 2 and L14+ rolls 3.
 *
 * Matches strictly on compendium source id; homebrew copies and unlinked items
 * are left alone. Idempotent: already-migrated rules are detected by their new
 * shape and skipped.
 */
class Migration024OathswornRefillMode extends MigrationBase {
	static override readonly version = 24;

	override readonly version = Migration024OathswornRefillMode.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;
		const sourceId = this.getSourceId(source);
		if (sourceId !== RADIANT_JUDGEMENT_SOURCE_ID) return;

		const rules: any[] = Array.isArray(source.system?.rules) ? source.system.rules : [];
		const poolRule = rules.find((rule) => rule?.id === JUDGMENT_POOL_RULE_ID);
		if (!poolRule) return;

		const refills: any[] = Array.isArray(poolRule.refills) ? poolRule.refills : [];
		const target = refills.find((entry) => entry?.trigger === 'onAttacked');
		if (!target) return;

		const alreadyMigrated = target.mode === 'setIfEmpty' && target.value === '@poolMax';
		if (alreadyMigrated) return;

		target.mode = 'setIfEmpty';
		target.value = '@poolMax';

		// eslint-disable-next-line no-console
		console.log(
			`Nimble Migration | ${source.name ?? sourceId}: updated onAttacked refill to setIfEmpty / @poolMax`,
		);
	}
}

export { Migration024OathswornRefillMode };
