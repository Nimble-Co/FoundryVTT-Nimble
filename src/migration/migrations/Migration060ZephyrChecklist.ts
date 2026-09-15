import {
	ChecklistMigrationBase,
	type EffectSource,
	FEATURE_PREFIX,
	type FeatureSpec,
	type RuleSource,
} from '../ChecklistMigrationBase.js';

const SWIFT_FISTS_RULES: RuleSource[] = [
	{
		type: 'unarmedDamage',
		disabled: false,
		id: 'Emjgw5cUztNbvzu5',
		identifier: '',
		label: 'Swift Fists',
		predicate: {},
		priority: 1,
		value: '1d4 + @abilities.strength.mod',
	},
];

const SWIFT_FISTS_OLD_DESCRIPTION =
	'<p>Your unarmed strikes are not subject to disadvantage imposed by Rushed Attacks (see pg. 13 of the Core Rules).</p>';

const SWIFT_FISTS_DESCRIPTION =
	'<p>Your unarmed strikes are not subject to disadvantage imposed by Rushed Attacks (see pg. 13 of the Core Rules), and their damage is 1d4+STR.</p>';

/** One action now, spent on the unarmed strike, once until the Zephyr's next turn ends. */
const QUICKSTRIKE_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: '1HKRLtUhQxrFwUJY',
		identifier: 'quickstrike-round',
		label: 'Quickstrike (once per round)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: true,
		showAsResource: false,
		recoveries: [
			{ trigger: 'onTurnEnd', mode: 'refresh', value: '1' },
			{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
		],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: '5nQl9jEcRz63J9UE',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'quickstrike-round',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
	{
		type: 'actionDelta',
		disabled: false,
		id: 'EXXA4m4drUjXLrSo',
		identifier: '',
		label: 'Quickstrike',
		predicate: {},
		priority: 3,
		value: '1',
		timing: 'now',
		target: 'self',
		borrowFromNextTurn: false,
	},
];

const QUICKSTRIKE_EFFECTS: EffectSource[] = [
	{
		id: 'lTyPeYJqp7me1BEg',
		type: 'note',
		noteType: 'reminder',
		text: 'When you Interpose, make an unarmed strike against that enemy for free.',
		parentContext: null,
		parentNode: null,
	},
];

const ETHEREAL_PROJECTION_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'oC9XGyyteDByPTkd',
		identifier: 'ethereal-projection-uses',
		label: 'Ethereal Projection (1/Safe Rest)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'NO9OEuCqx7zVZDkM',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'ethereal-projection-uses',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
];

const MARTIAL_ARTS_ABILITY_DESCRIPTION =
	'<p>Choose a Martial Arts Ability.</p><hr><p>Level 6: Choose a 2nd Martial Arts Ability.</p><p>Level 8: Choose a 3rd Martial Arts Ability.</p><p>Level 10: Choose a 4th Martial Arts Ability.</p><p>Level 12: Choose a 5th Martial Arts Ability.</p><p>Level 14: Choose a 6th Martial Arts Ability.</p><p>Level 16: Choose a 7th Martial Arts Ability.</p><p>Level 18: Choose an 8th Martial Arts Ability.</p>';

/**
 * Brings existing Zephyr features up to what the pack now ships (the Zephyr
 * checklist pass).
 *
 * Swift Fists names its unarmed damage again and states it in the description,
 * Quickstrike gains the once a round action it hands the Zephyr and the reminder
 * of what it buys, Ethereal Projection gains the Safe Rest use it spends, and
 * Martial Arts Ability gains the description it never had.
 */
class Migration060ZephyrChecklist extends ChecklistMigrationBase {
	static override readonly version = 60;

	override readonly version = Migration060ZephyrChecklist.version;

	protected override readonly classIdentifier = 'zephyr';

	protected override readonly passName = 'the Zephyr pass';

	protected override readonly features: FeatureSpec[] = [
		{
			sourceId: `${FEATURE_PREFIX}kHJVcWe64VhHsOFu`,
			name: 'swift fists',
			rules: SWIFT_FISTS_RULES,
			description: { from: SWIFT_FISTS_OLD_DESCRIPTION, to: SWIFT_FISTS_DESCRIPTION },
		},
		{
			sourceId: `${FEATURE_PREFIX}VqMwiol43RCzWXNf`,
			name: 'quickstrike',
			rules: QUICKSTRIKE_RULES,
			effects: QUICKSTRIKE_EFFECTS,
		},
		{
			sourceId: `${FEATURE_PREFIX}g8L5idExS3uMEEul`,
			name: 'ethereal projection',
			rules: ETHEREAL_PROJECTION_RULES,
		},
		{
			sourceId: `${FEATURE_PREFIX}hzPmX5UlMRWJukc3`,
			name: 'martial arts ability',
			description: { from: '', to: MARTIAL_ARTS_ABILITY_DESCRIPTION },
		},
	];
}

export { Migration060ZephyrChecklist };
