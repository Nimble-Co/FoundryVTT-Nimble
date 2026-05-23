import { MigrationBase } from '../MigrationBase.js';

const RADIANT_JUDGEMENT_SOURCE_ID = 'Compendium.nimble.class-features.Item.qiQeJrIxla9y6XY0';
const UNENDING_JUDGMENT_SOURCE_ID = 'Compendium.nimble.class-features.Item.XgudS8RAy0dVKBat';
const JUDGMENT_POOL_RULE_ID = 'judgment-pool-base';
const UNENDING_JUDGMENT_RULE_ID = 'unending-judgment-l18';

const ENCOUNTER_END_CLEAR_REFILL = {
	trigger: 'encounterEnd',
	mode: 'clear',
	value: '0',
} as const;

const UNENDING_JUDGMENT_RULE = {
	type: 'damageBonus',
	disabled: false,
	id: UNENDING_JUDGMENT_RULE_ID,
	identifier: '',
	label: 'Unending Judgment',
	predicate: { self: 'noJudgmentDice' },
	priority: 1,
	value: '5',
	damageType: '',
	delivery: 'melee',
	source: 'weapon',
} as const;

/**
 * Migrates the Oathsworn Judgment Dice feature set to its corrected shape:
 *
 * Radiant Judgement (L1+):
 * 1. `onAttacked` refill changes from `mode: "set"` / `value: "2"` to
 *    `mode: "setIfEmpty"` / `value: "@poolMax"`. Fixes two correctness bugs:
 *    - `set` re-rolled the pool every onAttacked even when dice were live.
 *    - Hard-coded `2` ignored the L14 "roll 1 more" modifier; `@poolMax`
 *      resolves against the per-actor pool max so L1 rolls 2 and L14+ rolls 3.
 * 2. Adds an `encounterEnd` refill with `mode: "clear"` so the pool wipes at
 *    end of combat. Rulebook: "The dice are expended whether you hit or miss,"
 *    paired with "if you have no Judgment Dice" gating on refill — together
 *    these mean the pool must end the encounter empty.
 *
 * Unending Judgment (L18):
 * 3. Backfills the `damageBonus` rule that grants +5 melee damage while the
 *    Judgment Dice pool is empty. Predicate keys off the auto-published
 *    `self:noJudgmentDice` domain tag.
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

		if (sourceId === RADIANT_JUDGEMENT_SOURCE_ID) {
			this.migrateRadiantJudgement(source);
			return;
		}

		if (sourceId === UNENDING_JUDGMENT_SOURCE_ID) {
			this.migrateUnendingJudgment(source);
			return;
		}
	}

	private migrateRadiantJudgement(source: any): void {
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
				`Nimble Migration | ${source.name ?? RADIANT_JUDGEMENT_SOURCE_ID}: updated Judgment Dice refill rules`,
			);
		}
	}

	private migrateUnendingJudgment(source: any): void {
		if (!source.system) return;
		if (!Array.isArray(source.system.rules)) {
			source.system.rules = [];
		}
		const rules: any[] = source.system.rules;

		const alreadyHasRule = rules.some((rule) => rule?.id === UNENDING_JUDGMENT_RULE_ID);
		if (alreadyHasRule) return;

		rules.push(foundry.utils.deepClone(UNENDING_JUDGMENT_RULE));
		// eslint-disable-next-line no-console
		console.log(
			`Nimble Migration | ${source.name ?? UNENDING_JUDGMENT_SOURCE_ID}: backfilled Unending Judgment damage bonus`,
		);
	}
}

export { Migration024OathswornRefillMode };
