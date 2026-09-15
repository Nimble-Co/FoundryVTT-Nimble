import {
	ChecklistMigrationBase,
	FEATURE_PREFIX,
	type FeatureSpec,
	type RuleSource,
} from '../ChecklistMigrationBase.js';

/** The rule the pack now ships on Forager, id included. */
const FORAGER_RULES: RuleSource[] = [
	{
		type: 'situationalRollMode',
		disabled: false,
		id: '9jrjpKpM5T57Wa7r',
		identifier: '',
		label: 'Finding food and water in the wild',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['all'],
	},
];

/** Keen Sight bends Perception itself, so it reads as a flat skill roll mode. */
const KEEN_SIGHT_RULES: RuleSource[] = [
	{
		type: 'skillRollMode',
		disabled: false,
		id: '6QGM2txygKfA7mpY',
		identifier: '',
		label: 'Keen Sight',
		predicate: {},
		priority: 1,
		skills: ['perception'],
		value: 1,
		mode: 'adjust',
	},
];

const SKILLED_TRACKER_RULES: RuleSource[] = [
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'HWumOYrtF2r6J2lz',
		identifier: '',
		label: 'Tracking a creature',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['all'],
	},
];

const SKILLED_TRACKER_OLD_DESCRIPTION =
	'<p>You have advantage on skill checks to track creatures</p>';

const SKILLED_TRACKER_DESCRIPTION = '<p>You have advantage on skill checks to track creatures.</p>';

/**
 * Brings existing Hunter features up to what the pack now ships (the Hunter
 * checklist pass).
 *
 * Forager claims the advantage it reads for food and water, Keen Sight the
 * advantage it holds on Perception, and Skilled Tracker the advantage it reads
 * while tracking, plus the full stop its description lost.
 */
class Migration059HunterChecklist extends ChecklistMigrationBase {
	static override readonly version = 59;

	override readonly version = Migration059HunterChecklist.version;

	protected override readonly classIdentifier = 'hunter';

	protected override readonly passName = 'the Hunter pass';

	protected override readonly features: FeatureSpec[] = [
		{
			sourceId: `${FEATURE_PREFIX}wZ4Q5MjM1xHp8xsx`,
			name: 'forager',
			rules: FORAGER_RULES,
		},
		{
			sourceId: `${FEATURE_PREFIX}IXFxaKSsPtHZ313f`,
			name: 'keen sight',
			rules: KEEN_SIGHT_RULES,
		},
		{
			sourceId: `${FEATURE_PREFIX}OLeuiigkHkCUnxrK`,
			name: 'skilled tracker',
			rules: SKILLED_TRACKER_RULES,
			description: { from: SKILLED_TRACKER_OLD_DESCRIPTION, to: SKILLED_TRACKER_DESCRIPTION },
		},
	];
}

export { Migration059HunterChecklist };
