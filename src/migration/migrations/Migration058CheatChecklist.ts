import {
	ChecklistMigrationBase,
	type EffectSource,
	FEATURE_PREFIX,
	type FeatureSpec,
	type RuleSource,
} from '../ChecklistMigrationBase.js';

/** The rules the pack now ships on Cheat!, ids included. */
const CHEAT_RULES: RuleSource[] = [
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'IcKe27NHzAsdT0T0',
		identifier: '',
		label: 'Playing a game, competing, or placing a wager',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['all'],
	},
	{
		type: 'chargePool',
		disabled: false,
		id: '3dT1X6L8FsDqVgdo',
		identifier: 'cheat-free-move-or-hide',
		label: 'Free Move or Hide (1/round)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: true,
		showAsResource: false,
		recoveries: [
			{ trigger: 'onTurnStart', mode: 'refresh', value: '1' },
			{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
		],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'kjeK5TE6b0P8jjup',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'cheat-free-move-or-hide',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
	{
		type: 'actionDelta',
		disabled: false,
		id: 'zEpqjsJl49AcfRyH',
		identifier: '',
		label: 'Free Move or Hide',
		predicate: {},
		priority: 3,
		value: '1',
		timing: 'now',
		target: 'self',
		borrowFromNextTurn: false,
	},
];

/**
 * The free action is a Move or a Hide, a limit no rule can hold, and the two
 * parts of the feature the player applies by hand.
 */
const CHEAT_EFFECTS: EffectSource[] = [
	{
		id: 'OXRBcboLwVAmHnkY',
		type: 'note',
		noteType: 'reminder',
		text: 'Spend the extra action on a Move or a Hide only.',
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'q7VbN2kLwXp4RsTe',
		type: 'note',
		noteType: 'reminder',
		text: '1/day: you may change any skill check to 10+INT.',
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'Xm3kQp9vLt2RwHn7',
		type: 'note',
		noteType: 'reminder',
		text: 'If you roll under 10 on Initiative, you may change it to 10.',
		parentContext: null,
		parentNode: null,
	},
];

const SWEET_TALK_RULES: RuleSource[] = [
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'loy2dA3ngmIEphzU',
		identifier: '',
		label: 'An NPC you have just met (until you fail a check with them or meet again)',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['influence'],
	},
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'y5EICRH40pAkITTY',
		identifier: '',
		label: 'An NPC you already Sweet Talked (until you get back on their good side)',
		predicate: {},
		priority: 1,
		value: -1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['influence'],
	},
];

const UNDERHANDED_ABILITIES_DESCRIPTION =
	'<p>Choose an Underhanded Ability.</p><hr><p>Level 6: Choose a 2nd Underhanded Ability.</p><p>Level 8: Choose a 3rd Underhanded Ability.</p><p>Level 10: Choose a 4th Underhanded Ability.</p><p>Level 12: Choose a 5th Underhanded Ability.</p><p>Level 14: Choose a 6th Underhanded Ability.</p><p>Level 16: Choose a 7th Underhanded Ability.</p><p>Level 18: Choose an 8th Underhanded Ability.</p>';

/**
 * Brings existing The Cheat features up to what the pack now ships (the Cheat
 * checklist pass).
 *
 * Cheat! gains the once a round use it spends, the action it hands itself, the
 * advantage it claims at a game or a wager, and the reminders for the action's
 * limit and the two parts the player applies by hand. Sweet Talk bends Influence
 * both ways, and Underhanded Abilities gains the description it never had.
 */
class Migration058CheatChecklist extends ChecklistMigrationBase {
	static override readonly version = 58;

	override readonly version = Migration058CheatChecklist.version;

	protected override readonly classIdentifier = 'the-cheat';

	protected override readonly passName = 'the Cheat pass';

	protected override readonly features: FeatureSpec[] = [
		{
			sourceId: `${FEATURE_PREFIX}6hqJxGuTsQnL21zP`,
			name: 'cheat!',
			rules: CHEAT_RULES,
			effects: CHEAT_EFFECTS,
		},
		{
			sourceId: `${FEATURE_PREFIX}BIr5jOM9XZvZpshv`,
			name: 'underhanded abilities',
			description: { from: '', to: UNDERHANDED_ABILITIES_DESCRIPTION },
		},
		{
			sourceId: `${FEATURE_PREFIX}CtYD5JoR25Zra28B`,
			name: 'sweet talk',
			rules: SWEET_TALK_RULES,
		},
	];
}

export { Migration058CheatChecklist };
