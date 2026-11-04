import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

/** A path of the item's system, written only while it still holds `from`. */
interface FieldWrite {
	path: string;
	from: unknown;
	to: unknown;
}

interface PackItemSpec {
	sourceId: string;
	type: 'ancestryBonus' | 'boon' | 'feature' | 'spell';
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	/** Empty for an item with no class: the type and the name match it. */
	classIdentifier: string;
	/** Rules the pack shipped before, so these do not count as the GM's own. */
	shippedRuleIds?: string[];
	rules?: RuleSource[];
	/** Written only while the rule still holds every value of `old`. */
	ruleChange?: { old: RuleSource; field: string; to: unknown };
	writes?: FieldWrite[];
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';
const ANCESTRY_BONUS_PREFIX = 'Compendium.nimble.nimble-ancestry-bonuses.Item.';
const BOON_PREFIX = 'Compendium.nimble.nimble-boons.Item.';
const SPELL_PREFIX = 'Compendium.nimble.nimble-spells.Item.';
const LEGACY_SPELL_PREFIX = 'Compendium.nimble.spells.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}PTYU9MJcVsRo5eVT`,
		type: 'ancestryBonus',
		name: 'hollow bones',
		classIdentifier: '',
		shippedRuleIds: ['77PFA7AbSWEB2h30'],
		rules: [
			{
				type: 'attackOutcome',
				disabled: false,
				identifier: '',
				predicate: {},
				priority: 1,
				cannotMiss: false,
				critRange: 0,
				forceCrit: 'none',
				anyDieCrits: false,
				critD20: false,
				viciousCrits: true,
				attackDelivery: 'any',
				attackSource: 'any',
				thisItemOnly: false,
				exceptItemIdentifier: '',
				otherCreature: {},
				chargePoolIdentifier: '',
				id: '4TzLGYOnMUHu5res',
				label: 'Hollow Bones',
				side: 'attacksAgainstYou',
			},
		],
	},
	{
		sourceId: `${BOON_PREFIX}2LHO6o2innfQWRa4`,
		type: 'boon',
		name: 'epic criticals',
		classIdentifier: '',
		rules: [
			{
				type: 'attackOutcome',
				disabled: false,
				identifier: '',
				predicate: {},
				priority: 1,
				cannotMiss: false,
				critRange: 0,
				forceCrit: 'none',
				anyDieCrits: false,
				critD20: true,
				viciousCrits: false,
				attackDelivery: 'any',
				attackSource: 'any',
				thisItemOnly: false,
				exceptItemIdentifier: '',
				otherCreature: {},
				chargePoolIdentifier: '',
				id: '5VmRtOHbOkMuWZMs',
				label: 'Epic Criticals',
				side: 'yourAttacks',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}V66ATYkNUXDrrCf3`,
		type: 'feature',
		name: 'juggernaut',
		classIdentifier: 'commander',
		rules: [
			{
				type: 'offerAttackBonus',
				disabled: false,
				id: 'juggernautOffer1',
				identifier: '',
				label: 'Juggernaut',
				predicate: {},
				priority: 1,
				offerSource: 'coordinated-strike',
				damage: '@attributes.armor.value',
				primaryDie: 1,
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [
					{
						id: 'IqEVFq6bKyOspDba',
						type: 'damage',
						damageType: 'psychic',
						formula: '@attributes.armor.value',
						parentContext: null,
						parentNode: null,
						canCrit: false,
						canMiss: false,
						on: {
							hit: [
								{
									id: 'J1jF8o8v0mlvw5Ob',
									type: 'note',
									noteType: 'warning',
									text: 'damage equal to your armor',
									parentContext: 'hit',
									parentNode: 'IqEVFq6bKyOspDba',
								},
								{
									id: 'ZMCkbXGT55MPKSsT',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'IqEVFq6bKyOspDba',
								},
							],
						},
					},
				],
				to: [],
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}6xpILHYt5KTSnTtd`,
		type: 'feature',
		name: 'coordinated strike!',
		classIdentifier: 'commander',
		ruleChange: {
			old: {
				type: 'grantActivation',
				disabled: false,
				id: 'coordinated-strike-ally-attack',
				identifier: '',
				label: 'Coordinated Strike',
				predicate: {},
				priority: 3,
				activationType: 'weaponAttack',
			},
			field: 'includesUser',
			to: true,
		},
		writes: [
			{
				path: 'identifier',
				from: '',
				to: 'coordinated-strike',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}F8GZjiNa1xhcDSlg`,
		type: 'feature',
		name: 'elemental surge',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'initiativeMana',
				disabled: false,
				id: 'elementalSurge01',
				identifier: '',
				label: 'Elemental Surge',
				predicate: {
					level: {
						max: 9,
					},
				},
				priority: 1,
				flat: '@will',
				dice: '',
			},
			{
				type: 'initiativeMana',
				disabled: false,
				id: 'elementalSurge02',
				identifier: '',
				label: 'Elemental Surge',
				predicate: {
					level: {
						min: 10,
						max: 16,
					},
				},
				priority: 1,
				flat: '@will',
				dice: '1d4',
			},
			{
				type: 'initiativeMana',
				disabled: false,
				id: 'elementalSurge03',
				identifier: '',
				label: 'Elemental Surge',
				predicate: {
					level: {
						min: 17,
					},
				},
				priority: 1,
				flat: '@will',
				dice: '2d4',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}bEm55OIxwJdzzn8m`,
		type: 'feature',
		name: 'force of chaos',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'tableRoll',
				disabled: false,
				id: 'forceOfChaos0001',
				identifier: '',
				label: 'Force of Chaos',
				predicate: {},
				priority: 1,
				table: 'chaos',
				when: 'lessManaOrCrit',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}g7lFxdEnjQtedrkN`,
		type: 'feature',
		name: 'chaos lash',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'tableRoll',
				disabled: false,
				id: 'chaos-lash-chaos',
				identifier: '',
				label: 'Chaos Lash',
				predicate: {},
				priority: 4,
				table: 'chaos',
				when: 'onUse',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}1y5lwLW6BVGoi6dJ`,
		type: 'feature',
		name: 'master of chaos',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'tableRollOptions',
				disabled: false,
				id: 'masterOfChaos001',
				identifier: '',
				label: 'Master of Chaos',
				predicate: {},
				priority: 1,
				table: 'chaos',
				rollTwice: false,
				chooseChargePool: '',
				advantage: true,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}DhbawC6zB1yvJ1hx`,
		type: 'feature',
		name: 'thrive in chaos',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'thriveInChaos001',
				identifier: 'thrive-in-chaos',
				label: 'Thrive in Chaos (1/Safe Rest)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'tableRollOptions',
				disabled: false,
				id: 'thriveInChaos002',
				identifier: '',
				label: 'Thrive in Chaos',
				predicate: {},
				priority: 2,
				table: 'chaos',
				rollTwice: true,
				chooseChargePool: 'thrive-in-chaos',
				advantage: false,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}u7UhIHOiXrAv6DEY`,
		type: 'feature',
		name: 'steel will',
		classIdentifier: 'mage',
		shippedRuleIds: ['zTiDDLUsYbobOvbi', 'cHqRdj1yLggWXMPL'],
		rules: [
			{
				type: 'initiativeManaRerollOnes',
				disabled: false,
				id: 'steelWillSurge01',
				identifier: '',
				label: 'Steel Will',
				predicate: {},
				priority: 2,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}RwYoKWa0TQYzh7X1`,
		type: 'feature',
		name: 'elemental destruction',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'reroll',
				disabled: false,
				id: 'elementalDestroy',
				identifier: '',
				label: 'Elemental Destruction',
				predicate: {},
				priority: 1,
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				relatedStat: '',
				die: 'pickedDie',
				maxDice: '@will',
				perDie: true,
				keep: 'new',
				useAnotherStat: false,
				automatic: false,
				discardedCritTriggers: false,
				rollModeChange: 0,
				primaryDieBonus: 0,
				extraDamage: '',
				outcome: 'hit',
				attackDelivery: 'any',
				attackSource: 'spell',
				thisItemOnly: false,
				otherCreature: {},
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 1,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				actionReportOnly: false,
				oncePerTurn: false,
				oncePerRoll: true,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}S2CSClkXO6ds2NZA`,
		type: 'feature',
		name: 'avenger',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'poolDieToMax',
				disabled: false,
				id: 'avengerDiceToMax',
				identifier: '',
				label: 'Avenger',
				predicate: {},
				priority: 7,
				poolIdentifier: 'judgment',
				trigger: 'onWound',
				reach: 4,
			},
			{
				type: 'freeMove',
				disabled: false,
				id: 'avengerFreeMoves',
				identifier: '',
				label: 'Avenger',
				predicate: {},
				priority: 8,
				trigger: 'afterPoolDiceToMax',
				poolIdentifier: '',
				distance: 'floor(@speed / 2)',
				recipient: 'self',
				within: 12,
				direction: 'any',
				ignoresDifficultTerrain: false,
				chargePoolIdentifier: '',
				whisper: false,
			},
			{
				type: 'diceConsumer',
				disabled: false,
				id: 'avengerConsumer1',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'judgment',
				poolScope: 'item',
				mode: 'manual',
				cost: '1',
				bonusOnAttackDelivery: null,
				effectFormula: null,
				effectType: 'generic',
				selectionOutcome: 'maximize',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}QLQALJ9AGcGECkFy`,
		type: 'feature',
		name: 'maximum judgment',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'poolDieToMax',
				disabled: false,
				id: 'maximumJudgment1',
				identifier: '',
				label: 'Maximum Judgment',
				predicate: {},
				priority: 7,
				poolIdentifier: 'judgment',
				trigger: 'onAttacked',
				reach: 0,
			},
			{
				type: 'diceConsumer',
				disabled: false,
				id: 'maximumJudgment2',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'judgment',
				poolScope: 'item',
				mode: 'manual',
				cost: '1',
				bonusOnAttackDelivery: null,
				effectFormula: null,
				effectType: 'generic',
				selectionOutcome: 'maximize',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}3jOQK87BBM5woiYT`,
		type: 'feature',
		name: 'shadow rush',
		classIdentifier: 'shadowmancer',
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'srNoteMinionDies',
						type: 'note',
						noteType: 'reminder',
						text: 'One shadow minion deals its max, then dies. Use this once per minion and remove that minion.',
						parentContext: null,
						parentNode: null,
					},
					{
						id: 'srMaxDamageNode1',
						type: 'damage',
						damageType: 'necrotic',
						formula: '12',
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'srFullDamageOut1',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'srMaxDamageNode1',
								},
							],
						},
						canCrit: false,
						canMiss: false,
					},
				],
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}PXcjp6eKxX1hYIdW`,
		type: 'feature',
		name: 'powerful healer',
		classIdentifier: 'shepherd',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'XXHoJSZEiXZVhMbG',
				identifier: 'powerful-healer',
				label: 'Powerful Healer (WIL/Safe Rest)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: 'max(@will, 0)',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				disabled: false,
				identifier: '',
				predicate: {},
				priority: 1,
				chargePoolIdentifier: 'powerful-healer',
				chargeCost: 1,
				type: 'maxDamage',
				id: '2CJK6Truo6dfwSED',
				label: 'Powerful Healer',
				use: 'healing',
				schools: [],
				givesCrit: false,
				tempHpChoice: true,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}lerWY2A6JkebdDFf`,
		type: 'feature',
		name: 'beastshift',
		classIdentifier: 'stormshifter',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: '9PUGbI3NijCBpU4K',
				identifier: 'beastshift',
				label: 'Beastshift charges',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: 'max(@dexterity, 0)',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: true,
				recoveries: [
					{
						trigger: 'safeRest',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'fnEPeUQetGZ9pNh7',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'beastshift',
				poolScope: 'item',
				costMode: 'fixed',
				cost: '1',
				maxCost: '',
				allowFree: true,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}zwUQKK1sZgMlm2wE`,
		type: 'feature',
		name: 'master of forms (2)',
		classIdentifier: 'stormshifter',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'masterOfForms2Pl',
				identifier: '',
				label: 'Master of Forms (2)',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'beastshift',
				dieSize: null,
				maxDelta: '+2',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}iM4BY2Pp3mU0L7ka`,
		type: 'feature',
		name: 'expert shifter',
		classIdentifier: 'stormshifter',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'goOQbEwPwDVj1PvJ',
				identifier: '',
				label: 'Expert Shifter',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'beastshift',
				dieSize: null,
				maxDelta: '+1',
			},
			{
				type: 'modifyPool',
				disabled: false,
				id: '3q04l3fn7f0s5jzV',
				identifier: '',
				label: 'Expert Shifter (2)',
				predicate: {
					level: {
						min: 9,
					},
				},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'beastshift',
				dieSize: null,
				maxDelta: '+1',
			},
			{
				type: 'modifyPool',
				disabled: false,
				id: 'Wa0PZ35pX1oKpEtb',
				identifier: '',
				label: 'Expert Shifter (3)',
				predicate: {
					level: {
						min: 12,
					},
				},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'beastshift',
				dieSize: null,
				maxDelta: '+1',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}0mllwocnYaQk80P2`,
		type: 'feature',
		name: 'stormborn (2)',
		classIdentifier: 'stormshifter',
		rules: [
			{
				disabled: false,
				identifier: '',
				predicate: {},
				priority: 1,
				chargePoolIdentifier: 'beastshift',
				chargeCost: 1,
				type: 'maxDamage',
				id: 'p8okGDnuRuS92SKT',
				label: 'Stormborn',
				use: 'damage',
				schools: ['wind'],
				givesCrit: true,
				tempHpChoice: false,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}iUnVel7m7UwYXt6U`,
		type: 'feature',
		name: 'sneak attack',
		classIdentifier: 'the-cheat',
		rules: [
			{
				type: 'critDice',
				disabled: false,
				id: 'sneakAttackDice1',
				identifier: 'sneak-attack',
				label: 'Sneak Attack',
				predicate: {
					level: {
						min: 1,
						max: 2,
					},
				},
				priority: 1,
				formula: '1d6',
				dieRole: 'critBonus',
				oncePerTurn: true,
				attackDelivery: 'any',
			},
			{
				type: 'critDice',
				disabled: false,
				id: 'sneakAttackDice2',
				identifier: 'sneak-attack',
				label: 'Sneak Attack',
				predicate: {
					level: {
						min: 3,
						max: 6,
					},
				},
				priority: 1,
				formula: '1d8',
				dieRole: 'critBonus',
				oncePerTurn: true,
				attackDelivery: 'any',
			},
			{
				type: 'critDice',
				disabled: false,
				id: 'sneakAttackDice3',
				identifier: 'sneak-attack',
				label: 'Sneak Attack',
				predicate: {
					level: {
						min: 7,
						max: 8,
					},
				},
				priority: 1,
				formula: '2d8',
				dieRole: 'critBonus',
				oncePerTurn: true,
				attackDelivery: 'any',
			},
			{
				type: 'critDice',
				disabled: false,
				id: 'sneakAttackDice4',
				identifier: 'sneak-attack',
				label: 'Sneak Attack',
				predicate: {
					level: {
						min: 9,
						max: 10,
					},
				},
				priority: 1,
				formula: '2d10',
				dieRole: 'critBonus',
				oncePerTurn: true,
				attackDelivery: 'any',
			},
			{
				type: 'critDice',
				disabled: false,
				id: 'sneakAttackDice5',
				identifier: 'sneak-attack',
				label: 'Sneak Attack',
				predicate: {
					level: {
						min: 11,
						max: 14,
					},
				},
				priority: 1,
				formula: '2d12',
				dieRole: 'critBonus',
				oncePerTurn: true,
				attackDelivery: 'any',
			},
			{
				type: 'critDice',
				disabled: false,
				id: 'sneakAttackDice6',
				identifier: 'sneak-attack',
				label: 'Sneak Attack',
				predicate: {
					level: {
						min: 15,
						max: 16,
					},
				},
				priority: 1,
				formula: '2d20',
				dieRole: 'critBonus',
				oncePerTurn: true,
				attackDelivery: 'any',
			},
			{
				type: 'critDice',
				disabled: false,
				id: 'sneakAttackDice7',
				identifier: 'sneak-attack',
				label: 'Sneak Attack',
				predicate: {
					level: {
						min: 17,
					},
				},
				priority: 1,
				formula: '3d20',
				dieRole: 'critBonus',
				oncePerTurn: true,
				attackDelivery: 'any',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}AUYr4Rjlu60zO6mU`,
		type: 'feature',
		name: 'twist the blade (1)',
		classIdentifier: 'the-cheat',
		rules: [
			{
				disabled: false,
				predicate: {},
				priority: 1,
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				die: 'critBonusDie',
				change: 'set',
				amount: 1,
				addsBonusOnSet: false,
				otherCreature: {},
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				oncePerRoll: false,
				cardHint: '',
				cardHintWhen: {},
				type: 'changeDie',
				id: 'twistTheBladePay',
				identifier: 'twist-the-blade',
				label: 'Twist the Blade',
				yieldsTo: 'twist-the-blade-free',
				actionCost: 1,
				actionReportOnly: true,
				oncePerTurn: false,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}xq83RVH7CABiSpkR`,
		type: 'feature',
		name: 'twist the blade (2)',
		classIdentifier: 'the-cheat',
		rules: [
			{
				disabled: false,
				predicate: {},
				priority: 1,
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				die: 'critBonusDie',
				change: 'set',
				amount: 1,
				addsBonusOnSet: false,
				otherCreature: {},
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				oncePerRoll: false,
				cardHint: '',
				cardHintWhen: {},
				type: 'changeDie',
				id: 'twistTheBladeFre',
				identifier: 'twist-the-blade-free',
				label: 'Twist the Blade',
				yieldsTo: '',
				actionCost: 0,
				actionReportOnly: false,
				oncePerTurn: true,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}jKWdnAj0kXxd2aN0`,
		type: 'feature',
		name: 'cunning strike',
		classIdentifier: 'the-cheat',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'cunningStrikePoo',
				identifier: 'cunning-strike',
				label: 'Cunning Strike (2/encounter)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '2',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{
						trigger: 'encounterStart',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'critDiceSave',
				disabled: false,
				id: 'cunningStrikeSav',
				identifier: '',
				label: 'Cunning Strike',
				predicate: {},
				priority: 2,
				saveType: 'strength',
				saveDC: '10+@intelligence',
				chargePoolIdentifier: 'cunning-strike',
			},
		],
		writes: [
			{
				path: 'activation.cost.details',
				from: '1 Use',
				to: '',
			},
			{
				path: 'activation.cost.type',
				from: 'special',
				to: 'none',
			},
			{
				path: 'activation.effects',
				from: [
					{
						id: 'ePNURkryI1sqKPP8',
						type: 'savingThrow',
						savingThrowType: 'strength',
						parentContext: null,
						parentNode: null,
						saveType: 'strength',
						on: {
							passedSave: [
								{
									id: 'kinxaTHt0Wm3ADEr',
									type: 'note',
									noteType: 'general',
									text: 'Regain 1 Use',
									parentContext: 'passedSave',
									parentNode: 'ePNURkryI1sqKPP8',
								},
							],
							failedSave: [
								{
									id: 'RZIR2ELTluJxgd84',
									type: 'note',
									noteType: 'general',
									text: 'Sneak Attack do maximum amount of Damage',
									parentContext: 'failedSave',
									parentNode: 'ePNURkryI1sqKPP8',
								},
							],
						},
						sharedRolls: [],
						saveDC: '10+@intelligence',
					},
				],
				to: [],
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}YgZwzCSYhDlz6KrF`,
		type: 'spell',
		name: 'shatter',
		classIdentifier: '',
		shippedRuleIds: ['Hd4sYc8ZfG1uJb6E'],
		rules: [
			{
				type: 'changeDie',
				disabled: false,
				id: 'shatterPlusOnDie',
				identifier: '',
				label: 'Shatter',
				predicate: {},
				priority: 1,
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				die: 'pickedDie',
				change: 'add',
				amount: 1,
				addsBonusOnSet: false,
				rowPerUpcastStep: true,
				yieldsTo: '',
				outcome: 'always',
				attackDelivery: 'any',
				attackSource: 'any',
				thisItemOnly: true,
				otherCreature: {},
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				actionReportOnly: false,
				oncePerTurn: false,
				oncePerRoll: true,
				cardHint: '',
				cardHintWhen: {},
			},
		],
		writes: [
			{
				path: 'scaling',
				from: null,
				to: {
					mode: 'upcast',
					deltas: [
						{
							operation: 'addFlatDamage',
							value: 5,
							dice: null,
							condition: null,
							targetEffectId: 'rH36LrKjBo8nQCXa',
							durationType: null,
						},
					],
					choices: null,
				},
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}pLUyI3NQBJ6FV1mq`,
		type: 'spell',
		name: 'arc lightning',
		classIdentifier: '',
		writes: [
			{
				path: 'activation.targets.singleTargetAttack',
				from: null,
				to: true,
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}N9DAEOBnY6QyW7VM`,
		type: 'spell',
		name: 'razor wind',
		classIdentifier: '',
		writes: [
			{
				path: 'activation.targets.singleTargetAttack',
				from: null,
				to: true,
			},
		],
	},
];

function toPackSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)) {
		return `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`;
	}
	return snapshotId?.startsWith(LEGACY_SPELL_PREFIX)
		? `${SPELL_PREFIX}${snapshotId.slice(LEGACY_SPELL_PREFIX.length)}`
		: snapshotId;
}

function deepEquals(left: unknown, right: unknown): boolean {
	if (left === right) return true;

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right)) return false;
		return left.length === right.length && left.every((entry, i) => deepEquals(entry, right[i]));
	}

	if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
		return false;
	}

	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) return false;
	return leftKeys.every((key) =>
		deepEquals((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
	);
}

/**
 * Gives copies of the items of this work what the pack now ships: the rules of
 * Max Damage, crit dice, Judgment Dice, Initiative Mana, the Chaos Table and the
 * several dice reroll, and the changed fields of Juggernaut, Coordinated Strike,
 * Cunning Strike, Shatter, Razor Wind and Arc Lightning.
 *
 * A pack rule is added unless a rule with its id is there. Nothing is added
 * beside a rule of the GM's own with a type the added rules use, so a feature
 * never works twice. A rule with a pack id is never overwritten. A field is
 * written only while it holds the old pack value, and a rule changes only while
 * it is as shipped.
 *
 * Matched on compendium source id, falling back to the type, the class and the
 * name for a copy stripped of one. A second run changes nothing.
 */
class Migration075MaxAndDice extends MigrationBase {
	static override readonly version = 75;

	override readonly version = Migration075MaxAndDice.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		const spec = this.#match(source);
		if (!spec) return;

		if (spec.rules && system.rules == null) system.rules = [];
		const rules = Array.isArray(system.rules) ? system.rules : null;

		const rulesAdded = !!spec.rules && !!rules && this.#addRules(rules, spec);
		const ruleChanged = !!rules && this.#changeRule(rules, spec);
		const fieldsWritten = this.#writeFields(system, spec);

		if (!rulesAdded && !ruleChanged && !fieldsWritten) return;
		console.log(`Nimble Migration | ${source.name}: updated for max damage and dice`);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return PACK_ITEMS.find((spec) => spec.sourceId === sourceId);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) =>
				spec.type === source.type &&
				spec.name === name &&
				(!spec.classIdentifier || spec.classIdentifier === source.system.class),
		);
	}

	#addRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		const wantedRules = spec.rules ?? [];
		const packIds = new Set<unknown>([
			...(spec.shippedRuleIds ?? []),
			...wantedRules.map((rule) => rule.id),
		]);
		const packTypes = new Set(wantedRules.map((rule) => rule.type));
		const hasOwn = rules.some((rule) => packTypes.has(rule?.type) && !packIds.has(rule.id));
		if (hasOwn) return false;

		let changed = false;
		for (const wanted of wantedRules) {
			if (rules.some((rule) => rule?.id === wanted.id)) continue;
			rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	#changeRule(rules: RuleSource[], spec: PackItemSpec): boolean {
		if (!spec.ruleChange) return false;
		const { old, field, to } = spec.ruleChange;
		const rule = rules.find((candidate) => candidate?.id === old.id);
		if (!rule || !Object.entries(old).every(([key, value]) => deepEquals(rule[key], value))) {
			return false;
		}
		rule[field] = to;
		return true;
	}

	#writeFields(system: any, spec: PackItemSpec): boolean {
		let changed = false;
		for (const { path, from, to } of spec.writes ?? []) {
			const current = foundry.utils.getProperty(system, path) ?? null;
			// A new boolean field reads false once a document was saved with its default.
			if (!deepEquals(current, from) && !(to === true && current === false)) continue;
			foundry.utils.setProperty(system, path, foundry.utils.deepClone(to));
			changed = true;
		}
		return changed;
	}
}

export { Migration075MaxAndDice };
