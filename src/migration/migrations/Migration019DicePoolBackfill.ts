import { MigrationBase } from '../MigrationBase.js';

const RAGE_SOURCE_ID = 'Compendium.nimble.class-features.Item.GjPt8evcIoVuQ6zg';
const INTENSIFYING_FURY_SOURCE_ID = 'Compendium.nimble.class-features.Item.eedQA69WSnBTEC2y';
const RADIANT_JUDGEMENT_SOURCE_ID = 'Compendium.nimble.class-features.Item.qiQeJrIxla9y6XY0';
const FIT_FOR_ANY_BATTLEFIELD_SOURCE_ID = 'Compendium.nimble.class-features.Item.JiNcaklfRjgJ7e5W';

// Rule payloads here mirror the pack JSON exactly. If the pack content
// changes, update both sites; the migration is intentionally idempotent so
// a future migration can replace these blocks wholesale without disturbing
// users who already ran this one.

const RAGE_RULES = [
	{
		type: 'dicePool',
		disabled: false,
		id: 'fury-pool-base',
		identifier: 'fury',
		label: 'Fury Dice',
		predicate: {},
		priority: 1,
		scope: 'item',
		dieSize: 'd4',
		max: '@key',
		initial: 'zero',
		refills: [],
	},
];

const INTENSIFYING_FURY_RULES = [
	{
		type: 'modifyPool',
		disabled: false,
		id: 'fury-d6-l6',
		identifier: '',
		label: 'Fury Dice → d6',
		predicate: { level: { min: 6 } },
		priority: 2,
		poolType: 'dice',
		poolIdentifier: 'fury',
		dieSize: 'd6',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'fury-d8-l9',
		identifier: '',
		label: 'Fury Dice → d8',
		predicate: { level: { min: 9 } },
		priority: 3,
		poolType: 'dice',
		poolIdentifier: 'fury',
		dieSize: 'd8',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'fury-d10-l13',
		identifier: '',
		label: 'Fury Dice → d10',
		predicate: { level: { min: 13 } },
		priority: 4,
		poolType: 'dice',
		poolIdentifier: 'fury',
		dieSize: 'd10',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'fury-d12-l17',
		identifier: '',
		label: 'Fury Dice → d12',
		predicate: { level: { min: 17 } },
		priority: 5,
		poolType: 'dice',
		poolIdentifier: 'fury',
		dieSize: 'd12',
		maxDelta: null,
	},
];

const RADIANT_JUDGEMENT_RULES = [
	{
		type: 'dicePool',
		disabled: false,
		id: 'judgment-pool-base',
		identifier: 'judgment',
		label: 'Judgment Dice',
		predicate: {},
		priority: 1,
		scope: 'item',
		dieSize: 'd6',
		max: '2',
		initial: 'zero',
		refills: [{ trigger: 'onAttacked', mode: 'set', value: '2' }],
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'judgment-d8-l3',
		identifier: '',
		label: 'Judgment Dice → d8',
		predicate: { level: { min: 3 } },
		priority: 2,
		poolType: 'dice',
		poolIdentifier: 'judgment',
		dieSize: 'd8',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'judgment-d10-l5',
		identifier: '',
		label: 'Judgment Dice → d10',
		predicate: { level: { min: 5 } },
		priority: 3,
		poolType: 'dice',
		poolIdentifier: 'judgment',
		dieSize: 'd10',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'judgment-d12-l8',
		identifier: '',
		label: 'Judgment Dice → d12',
		predicate: { level: { min: 8 } },
		priority: 4,
		poolType: 'dice',
		poolIdentifier: 'judgment',
		dieSize: 'd12',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'judgment-d20-l10',
		identifier: '',
		label: 'Judgment Dice → d20',
		predicate: { level: { min: 10 } },
		priority: 5,
		poolType: 'dice',
		poolIdentifier: 'judgment',
		dieSize: 'd20',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'judgment-plus1-l14',
		identifier: '',
		label: 'Judgment Dice: roll 1 more',
		predicate: { level: { min: 14 } },
		priority: 6,
		poolType: 'dice',
		poolIdentifier: 'judgment',
		dieSize: null,
		maxDelta: '+1',
	},
];

const FIT_FOR_ANY_BATTLEFIELD_RULES = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'combat-dice-pool',
		identifier: 'combat-dice',
		label: 'Combat Dice',
		predicate: {},
		priority: 2,
		scope: 'item',
		max: '@strength',
		dieSize: 'd6',
		initial: 'zero',
		recoveries: [{ trigger: 'onInitiativeRolled', mode: 'refresh', value: '1' }],
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'combat-dice-d8-l5',
		identifier: '',
		label: 'Combat Dice → d8',
		predicate: { level: { min: 5 } },
		priority: 3,
		poolType: 'charge',
		poolIdentifier: 'combat-dice',
		dieSize: 'd8',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'combat-dice-d10-l9',
		identifier: '',
		label: 'Combat Dice → d10',
		predicate: { level: { min: 9 } },
		priority: 4,
		poolType: 'charge',
		poolIdentifier: 'combat-dice',
		dieSize: 'd10',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'combat-dice-d12-l13',
		identifier: '',
		label: 'Combat Dice → d12',
		predicate: { level: { min: 13 } },
		priority: 5,
		poolType: 'charge',
		poolIdentifier: 'combat-dice',
		dieSize: 'd12',
		maxDelta: null,
	},
	{
		type: 'modifyPool',
		disabled: false,
		id: 'combat-dice-d20-l17',
		identifier: '',
		label: 'Combat Dice → d20',
		predicate: { level: { min: 17 } },
		priority: 6,
		poolType: 'charge',
		poolIdentifier: 'combat-dice',
		dieSize: 'd20',
		maxDelta: null,
	},
];

const RULE_BACKFILL_BY_SOURCE_ID: Record<string, ReadonlyArray<Record<string, unknown>>> = {
	[RAGE_SOURCE_ID]: RAGE_RULES,
	[INTENSIFYING_FURY_SOURCE_ID]: INTENSIFYING_FURY_RULES,
	[RADIANT_JUDGEMENT_SOURCE_ID]: RADIANT_JUDGEMENT_RULES,
	[FIT_FOR_ANY_BATTLEFIELD_SOURCE_ID]: FIT_FOR_ANY_BATTLEFIELD_RULES,
};

/**
 * Backfills the new dicePool / chargePool / modifyPool rules onto embedded
 * copies of four canonical class-feature items: Rage, Intensifying Fury,
 * Radiant Judgement, and Fit for Any Battlefield.
 *
 * These rules ship in the compendium JSON, but actors who imported these
 * features before the rules existed carry a snapshot with empty `rules: []`
 * arrays. This migration matches strictly on compendium source id — homebrew
 * copies or otherwise unlinked items are left alone.
 *
 * The migration is idempotent: it only inserts a rule if no rule with the
 * same `id` is already present on the item.
 */
class Migration019DicePoolBackfill extends MigrationBase {
	static override readonly version = 19;

	override readonly version = Migration019DicePoolBackfill.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;
		const sourceId = this.getSourceId(source);
		if (!sourceId) return;

		const backfill = RULE_BACKFILL_BY_SOURCE_ID[sourceId];
		if (!backfill) return;

		if (!Array.isArray(source.system?.rules)) {
			source.system.rules = [];
		}

		const existingIds = new Set<string>(
			source.system.rules
				.map((r: { id?: unknown }) => (typeof r?.id === 'string' ? r.id : null))
				.filter((id: string | null): id is string => id !== null),
		);

		let added = 0;
		for (const rule of backfill) {
			const ruleId = rule.id as string | undefined;
			if (ruleId && existingIds.has(ruleId)) continue;
			source.system.rules.push(foundry.utils.deepClone(rule));
			added += 1;
		}

		if (added > 0) {
			// eslint-disable-next-line no-console
			console.log(
				`Nimble Migration | ${source.name ?? sourceId}: backfilled ${added} dice/charge pool rule(s)`,
			);
		}
	}
}

export { Migration019DicePoolBackfill };
