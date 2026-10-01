import {
	ChecklistMigrationBase,
	FEATURE_PREFIX,
	type FeatureSpec,
	type RuleSource,
} from '../ChecklistMigrationBase.js';

const AURA_OF_ZEAL_RULES: RuleSource[] = [
	{
		type: 'modifyPool',
		disabled: false,
		id: 'aura-of-zeal-judgment-plus1',
		identifier: '',
		label: 'Aura of Zeal: roll 1 more Judgment Die',
		predicate: {},
		priority: 1,
		poolType: 'dice',
		poolIdentifier: 'judgment',
		dieSize: null,
		maxDelta: '+1',
	},
];

/**
 * Give Aura of Zeal the modifyPool rule the pack now ships, so an Oath of
 * Vengeance Oathsworn already in a world rolls one more Judgment Die.
 */
class Migration065AuraOfZealJudgmentDie extends ChecklistMigrationBase {
	static override readonly version = 65;

	override readonly version = Migration065AuraOfZealJudgmentDie.version;

	protected override readonly classIdentifier = 'oathsworn';

	protected override readonly passName = 'the Aura of Zeal pass';

	protected override readonly features: FeatureSpec[] = [
		{
			sourceId: `${FEATURE_PREFIX}AwOBGBQ87459Nl2s`,
			name: 'aura of zeal',
			rules: AURA_OF_ZEAL_RULES,
		},
	];
}

export { Migration065AuraOfZealJudgmentDie };
