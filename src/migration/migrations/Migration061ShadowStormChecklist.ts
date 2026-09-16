import {
	ChecklistMigrationBase,
	FEATURE_PREFIX,
	type FeatureSpec,
	type RuleSource,
} from '../ChecklistMigrationBase.js';

const WHISPERS_OF_THE_GRAVE_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'eeRTBbdxdy5WERm5',
		identifier: 'whispers-of-the-grave-uses',
		label: 'Whispers of the Grave (1/Safe Rest)',
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
		id: 'LTZ2F4En9r9aLXcL',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'whispers-of-the-grave-uses',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
];

const VOICE_OF_THE_DARK_OLD_DESCRIPTION =
	'<p>You can communicate telepathically with a humanoid within 6 spaces</p>';

const VOICE_OF_THE_DARK_DESCRIPTION =
	'<p>You can communicate telepathically with a humanoid within 6 spaces.</p>';

const THE_PACT_IS_SEALED_DESCRIPTION =
	'<p>Choose a subclass and 1 Lesser Shadow Invocation.</p><hr><p>Level 8: Choose a 2nd Lesser Shadow Invocation.</p><p>Level 11: Choose a 3rd Lesser Shadow Invocation.</p>';

const GIFT_FROM_THE_MASTER_DESCRIPTION =
	'<p>Choose 1 Greater Shadow Invocation.</p><hr><p>Level 6: Choose a 2nd Greater Shadow Invocation.</p><p>Level 9: Choose a 3rd Greater Shadow Invocation.</p><p>Level 14: Choose a 4th Greater Shadow Invocation.</p><p>Level 18: Choose a 5th Greater Shadow Invocation.</p>';

/** Lightning resistance, the Safe Rest use, and the two rolls it may bend. */
const STORMBORN_RULES: RuleSource[] = [
	{
		type: 'damageReduction',
		disabled: false,
		id: 'mVO2vS0NGRfibjKU',
		identifier: '',
		label: 'Stormborn',
		predicate: {},
		priority: 1,
		mode: 'half',
		value: '1',
		damageTypes: ['lightning'],
	},
	{
		type: 'chargePool',
		disabled: false,
		id: 'Z7ZxALcnyd6l3Yfl',
		identifier: 'stormborn-uses',
		label: 'Stormborn (1/Safe Rest)',
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
		id: 'PjV3XrDzPbBd5NwE',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'stormborn-uses',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'ET9hTDp0Q8Z2T7Lj',
		identifier: '',
		label: 'Spending your Stormborn use on this check',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['naturecraft'],
	},
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'eS3yIvNidajuZFNn',
		identifier: '',
		label: 'Spending your Stormborn use to hold Concentration',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'savingThrow',
		saves: ['strength'],
		abilities: [],
		skills: [],
	},
];

/**
 * Brings existing Shadowmancer and Stormshifter features up to what the pack
 * now ships (the last class checklist pass).
 *
 * Whispers of the Grave gains the Safe Rest use it spends, Voice of the Dark its
 * full stop, The Pact is Sealed and Gift from the Master the descriptions they
 * never had, and Stormborn its lightning resistance, its Safe Rest use and the
 * two rolls it may bend.
 */
class Migration061ShadowStormChecklist extends ChecklistMigrationBase {
	static override readonly version = 61;

	override readonly version = Migration061ShadowStormChecklist.version;

	protected override readonly classIdentifier = 'shadowmancer';

	protected override readonly passName = 'the Shadowmancer and Stormshifter pass';

	protected override readonly features: FeatureSpec[] = [
		{
			sourceId: `${FEATURE_PREFIX}NeSyvsNLIbllvVX2`,
			name: 'whispers of the grave',
			rules: WHISPERS_OF_THE_GRAVE_RULES,
		},
		{
			sourceId: `${FEATURE_PREFIX}1GdXK5Vdqos78MrF`,
			name: 'voice of the dark',
			description: { from: VOICE_OF_THE_DARK_OLD_DESCRIPTION, to: VOICE_OF_THE_DARK_DESCRIPTION },
		},
		{
			sourceId: `${FEATURE_PREFIX}raag8F4HZP9Tign4`,
			name: 'the pact is sealed',
			description: { from: '', to: THE_PACT_IS_SEALED_DESCRIPTION },
		},
		{
			sourceId: `${FEATURE_PREFIX}JMOrhp9RnJkNL5U8`,
			name: 'gift from the master',
			description: { from: '', to: GIFT_FROM_THE_MASTER_DESCRIPTION },
		},
		{
			sourceId: `${FEATURE_PREFIX}U0wPSIvBFzxY0kE7`,
			name: 'stormborn (1)',
			classIdentifier: 'stormshifter',
			rules: STORMBORN_RULES,
		},
	];
}

export { Migration061ShadowStormChecklist };
