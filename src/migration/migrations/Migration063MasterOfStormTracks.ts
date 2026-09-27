import {
	ChecklistMigrationBase,
	FEATURE_PREFIX,
	type FeatureSpec,
	type RuleSource,
} from '../ChecklistMigrationBase.js';

const MASTER_OF_STORM_RULES: RuleSource[] = [
	{
		type: 'concentrationTrack',
		disabled: false,
		id: 'master-of-storm-concentration-tracks',
		identifier: '',
		label: 'Master of Storm: lightning and wind concentrate separately',
		predicate: {},
		priority: 1,
		schools: ['lightning', 'wind'],
	},
];

/**
 * Give Master of Storm the concentrationTrack rule the pack now ships, so a
 * level 15 Stormshifter already in a world holds a Lightning and a Wind
 * concentration rather than one.
 */
class Migration063MasterOfStormTracks extends ChecklistMigrationBase {
	static override readonly version = 63;

	override readonly version = Migration063MasterOfStormTracks.version;

	protected override readonly classIdentifier = 'stormshifter';

	protected override readonly passName = 'the Master of Storm pass';

	protected override readonly features: FeatureSpec[] = [
		{
			sourceId: `${FEATURE_PREFIX}8gTUauVQdm1Se1X6`,
			name: 'master of storm',
			rules: MASTER_OF_STORM_RULES,
		},
	];
}

export { Migration063MasterOfStormTracks };
