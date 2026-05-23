import { MigrationBase } from '../MigrationBase.js';

const RADIANT_JUDGEMENT_SOURCE_ID = 'Compendium.nimble.class-features.Item.qiQeJrIxla9y6XY0';
const JUDGMENT_POOL_RULE_ID = 'judgment-pool-base';

const ENCOUNTER_END_CLEAR_REFILL = {
	trigger: 'encounterEnd',
	mode: 'clear',
	value: '0',
} as const;

/**
 * Migrates the Oathsworn Radiant Judgement pool to its corrected refill shape:
 *
 * 1. `onAttacked` refill changes from `mode: "set"` / `value: "2"` to
 *    `mode: "setIfEmpty"` / `value: "@poolMax"`. Fixes two correctness bugs:
 *    - `set` re-rolled the pool every onAttacked even when dice were live.
 *    - Hard-coded `2` ignored the L14 "roll 1 more" modifier; `@poolMax`
 *      resolves against the per-actor pool max so L1 rolls 2 and L14+ rolls 3.
 *
 * 2. Adds an `encounterEnd` refill with `mode: "clear"` so the pool wipes at
 *    end of combat. Rulebook: "The dice are expended whether you hit or miss,"
 *    paired with "if you have no Judgment Dice" gating on refill — together
 *    these mean the pool must end the encounter empty.
 *
 * Matches strictly on compendium source id; homebrew copies and unlinked items
 * are left alone. Idempotent: already-migrated state is detected and skipped.
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

		if (!Array.isArray(poolRule.refills)) {
			poolRule.refills = [];
		}
		const refills: any[] = poolRule.refills;

		let changed = false;

		const onAttacked = refills.find((entry) => entry?.trigger === 'onAttacked');
		if (onAttacked && !(onAttacked.mode === 'setIfEmpty' && onAttacked.value === '@poolMax')) {
			onAttacked.mode = 'setIfEmpty';
			onAttacked.value = '@poolMax';
			changed = true;
		}

		const hasEncounterEndClear = refills.some(
			(entry) => entry?.trigger === 'encounterEnd' && entry?.mode === 'clear',
		);
		if (!hasEncounterEndClear) {
			refills.push({ ...ENCOUNTER_END_CLEAR_REFILL });
			changed = true;
		}

		if (changed) {
			// eslint-disable-next-line no-console
			console.log(
				`Nimble Migration | ${source.name ?? sourceId}: updated Judgment Dice refill rules`,
			);
		}
	}
}

export { Migration024OathswornRefillMode };
