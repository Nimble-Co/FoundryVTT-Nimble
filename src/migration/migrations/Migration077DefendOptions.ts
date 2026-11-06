import { isCompendiumId, SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
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
	type: 'ancestryBonus' | 'feature' | 'object' | 'spell';
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	/** Empty for an item with no class: the type and the name match it. */
	classIdentifier: string;
	/** Rules the pack shipped before, so these do not count as the GM's own. */
	shippedRuleIds?: string[];
	rules?: RuleSource[];
	writes?: FieldWrite[];
}

const ANCESTRY_BONUS_PREFIX = 'Compendium.nimble.nimble-ancestry-bonuses.Item.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const ITEM_PREFIX = 'Compendium.nimble.nimble-items.Item.';
const MAGIC_ITEM_PREFIX = 'Compendium.nimble.nimble-magic-items.Item.';
const SPELL_PREFIX = 'Compendium.nimble.nimble-spells.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}1cSW678NQBiWN5m4`,
		type: 'ancestryBonus',
		name: 'bunny legs',
		classIdentifier: '',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'NheWBoxfGYk7zUeb',
				identifier: 'bunny-legs',
				label: 'Bunny Legs (1/encounter)',
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
						trigger: 'encounterEnd',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'defendOption',
				disabled: false,
				id: '9jawbVTzVkRToKJx',
				identifier: '',
				label: 'Bunny Legs',
				predicate: {},
				priority: 2,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'After damage, hop up to your speed in any direction.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'bunny-legs',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}1YtCep32COT7uAYP`,
		type: 'ancestryBonus',
		name: 'reflective aura',
		classIdentifier: '',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'VCtxw6I2hp6I39VU',
				identifier: 'reflective-aura',
				label: 'Reflective Aura (1/encounter)',
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
						trigger: 'encounterEnd',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'defendOption',
				disabled: false,
				id: 'eKw4d9ZWn3ujCmLf',
				identifier: '',
				label: 'Reflective Aura',
				predicate: {},
				priority: 2,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '@key',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Deal KEY damage back to the attacker.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'reflective-aura',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}5Gf1lv0piL0PkYBF`,
		type: 'ancestryBonus',
		name: 'planeshift',
		classIdentifier: '',
		shippedRuleIds: ['fbhC9ohclITGwSq3'],
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'lk7RBQKI7wYot3ND',
				identifier: '',
				label: 'Planeshift',
				predicate: {},
				priority: 2,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'noDamage',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: '',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 1,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}37Vz4VGGMufLrkUd`,
		type: 'feature',
		name: 'use momentum',
		classIdentifier: 'zephyr',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: '8C6ebqtL1402M9gy',
				identifier: '',
				label: 'Use Momentum',
				predicate: {},
				priority: 1,
				way: 'withDefend',
				attackDelivery: 'melee',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					"If you take no damage, you may swap places with the attacker and choose another target now within the attack's reach; that target is hit instead.",
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}bIqEghM1BkChlRJD`,
		type: 'feature',
		name: 'burst of speed',
		classIdentifier: 'zephyr',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: '0LC1CfBCCPWhE36H',
				identifier: 'burst-of-speed',
				label: 'Bursts of Speed',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: 'max(@dexterity, 0)',
				dieSize: null,
				initial: 'zero',
				hidden: false,
				showAsResource: true,
				recoveries: [
					{
						trigger: 'encounterStart',
						mode: 'refresh',
						value: 'max(@dexterity, 0)',
					},
					{
						trigger: 'encounterEnd',
						mode: 'set',
						value: '0',
					},
				],
			},
			{
				type: 'defendOption',
				disabled: false,
				id: 'sQ7cBD08i6iX6DFr',
				identifier: '',
				label: 'Slipstream',
				predicate: {},
				priority: 2,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'miss',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: '',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'burst-of-speed',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
			{
				type: 'defendOption',
				disabled: false,
				id: 'vdHGRNYUnBIJ7mRG',
				identifier: '',
				label: 'Whirling Defense',
				predicate: {},
				priority: 3,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: '',
				useItem: false,
				withInterpose: false,
				wholeRound: true,
				range: 2,
				chargePoolIdentifier: 'burst-of-speed',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}eE1rSZ1XBAON8YXM`,
		type: 'feature',
		name: 'peerless hunter',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'JBrZtb4I1Evl5ZDm',
				identifier: '',
				label: 'Peerless Hunter (quarry)',
				predicate: {},
				priority: 1,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: '',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}FW8O4gZtT9qpaV8E`,
		type: 'feature',
		name: 'decoy',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: '3o31NiGWAprxPZLG',
				identifier: '',
				label: 'Decoy',
				predicate: {},
				priority: 1,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'miss',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Move up to half your speed away.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'thrill-of-the-hunt',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}GGSs5oI7c578HH9x`,
		type: 'feature',
		name: 'small - protect me!',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'HIUdTt9kgX1kiwGB',
				identifier: 'small-protect-me',
				label: 'Protect Me! (1/encounter)',
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
						trigger: 'encounterEnd',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'modifyPool',
				disabled: false,
				id: 'Obigq1Gp606QEymF',
				identifier: '',
				label: 'Protect Me! (2/encounter)',
				predicate: {
					level: {
						min: 7,
					},
				},
				priority: 2,
				poolType: 'charge',
				poolIdentifier: 'small-protect-me',
				dieSize: null,
				maxDelta: '1',
			},
			{
				type: 'defendOption',
				disabled: false,
				id: 'y6Yt3UfuhJSFwcqO',
				identifier: '',
				label: 'Protect Me!',
				predicate: {},
				priority: 3,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'miss',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Move up to half your speed away.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'small-protect-me',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}KjoswYrEObwj21q8`,
		type: 'feature',
		name: 'blur',
		classIdentifier: 'zephyr',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'oEPKAJCnhBPhF8Kz',
				identifier: 'blur',
				label: 'Blur (1/encounter)',
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
						trigger: 'encounterEnd',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'defendOption',
				disabled: false,
				id: '8YwUjcLcQJIw3GVT',
				identifier: '',
				label: 'Blur',
				predicate: {},
				priority: 2,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'First move up to half your speed away; take no damage if you are now out of range or have Full Cover.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'blur',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}LOKmP43TJEDltnnO`,
		type: 'feature',
		name: 'not my beautiful faaace!',
		classIdentifier: 'songweaver',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'mcaaktqnJSyDrSv9',
				identifier: 'not-my-beautiful-faaace',
				label: 'Not My Beautiful Faaace! (1/encounter)',
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
						trigger: 'encounterEnd',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'defendOption',
				disabled: false,
				id: 'uy2Urru5Jnh9RPqZ',
				identifier: '',
				label: 'Not My Beautiful Faaace!',
				predicate: {},
				priority: 2,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'The attacker makes a WIL save: on a fail they choose another target in range (if there is none, the attack fails; fail by 5+: they attack themselves); on a save they attack you with disadvantage.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'not-my-beautiful-faaace',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}MM8MxrvZ7jnoGOa8`,
		type: 'feature',
		name: 'pocket sand',
		classIdentifier: 'the-cheat',
		shippedRuleIds: ['MVE6XSpb5pjS6tzS', 'CqGMYxQoLrVI17x3'],
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'gku1RZDrb18nEnP3',
				identifier: '',
				label: 'Pocket Sand',
				predicate: {},
				priority: 3,
				way: 'withDefend',
				attackDelivery: 'melee',
				outcome: 'none',
				armorBonus: '',
				useReroll: true,
				attackerCondition: 'blinded',
				reminder: '',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}O0iwveCk3zoyRuF9`,
		type: 'feature',
		name: 'shield expert',
		classIdentifier: 'commander',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'xSFm1eDIZgnDrI2e',
				identifier: '',
				label: 'Shield Expert',
				predicate: {
					self: 'shield',
				},
				priority: 1,
				way: 'extraDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'The first time each round you block all of the damage, make a free opportunity attack against the attacker.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}QF1pwa9ybpNM9Nsl`,
		type: 'feature',
		name: 'glorious paragon',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'QhNeWwHLuOc55b8f',
				identifier: '',
				label: 'Glorious Paragon',
				predicate: {},
				priority: 1,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: '',
				useItem: false,
				withInterpose: true,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}RXTu7ntZOw8otv2t`,
		type: 'feature',
		name: 'windborne protector',
		classIdentifier: 'stormshifter',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'fIEaN6Yjhx9LAsqx',
				identifier: 'windborne-protector',
				label: 'Windborne Protector (1/encounter)',
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
						trigger: 'encounterEnd',
						mode: 'refresh',
						value: '1',
					},
				],
			},
			{
				type: 'defendOption',
				disabled: false,
				id: '96SZke2oF2L2FVGu',
				identifier: '',
				label: 'Windborne Protector',
				predicate: {},
				priority: 2,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Shift into a Fearsome Beast; you may Interpose from up to 12 spaces away.',
				useItem: false,
				withInterpose: true,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: 'windborne-protector',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 2,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}sUvQUIIhVrs1KMlM`,
		type: 'feature',
		name: 'martyr spawn',
		classIdentifier: 'shadowmancer',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'ov612oPGIDjKu0Qq',
				identifier: '',
				label: 'Martyr Spawn',
				predicate: {},
				priority: 1,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'noDamage',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Sacrifice a shadow minion.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}tZkAluN0peHdleIx`,
		type: 'feature',
		name: 'fearsome beast',
		classIdentifier: 'stormshifter',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'nryMD4SgvPmMNR2s',
				identifier: '',
				label: 'Fearsome',
				predicate: {},
				priority: 1,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Force the attacker to reroll the attack; you choose either result.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 1,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}uvhLoC3NA38uZF9h`,
		type: 'feature',
		name: 'misdirection',
		classIdentifier: 'the-cheat',
		shippedRuleIds: ['QFdjcfbD5ns5tJxu'],
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'qyjZ5OZioqa7feoq',
				identifier: '',
				label: 'Misdirection',
				predicate: {},
				priority: 2,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'halve',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: '',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}Vr5Yj3QIHuVQ69p0`,
		type: 'feature',
		name: 'exploit',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'yJYS8gmIOlNSVxz0',
				identifier: '',
				label: 'Exploit',
				predicate: {},
				priority: 1,
				way: 'allyDefends',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'Expend your Judgment Dice to force an enemy within your aura to Interpose (not against its own attack).',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 4,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 1,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}WpTBjJEqfLhiA37M`,
		type: 'feature',
		name: 'medium - protect me!',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'CLmYUbqdoPRDkIMw',
				identifier: '',
				label: 'Protect Me!',
				predicate: {},
				priority: 1,
				way: 'withDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Your companion may first attack the attacker for 1d4+LVL damage.',
				useItem: false,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}8mEsmtEVQNPadPIi`,
		type: 'object',
		name: 'hard leather',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'leather',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}Bdm2ynI2J7Xt9FNf`,
		type: 'object',
		name: "adventurer's garb",
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'cloth',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}ExSohwUQJH6k2pmx`,
		type: 'object',
		name: 'rusty plate',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'plate',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}Fg9t0JlrQ5eHL8VD`,
		type: 'object',
		name: 'full plate',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'plate',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}j2aRVSozXiIZfj7y`,
		type: 'object',
		name: 'dragonscale',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'mail',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}jJHrcyDD6ByCnrFJ`,
		type: 'object',
		name: 'rusty mail',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'mail',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}nKk3NTdbE9Ktptoz`,
		type: 'object',
		name: 'chain shirt',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'mail',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}oOOmASw6sbPyKEAf`,
		type: 'object',
		name: 'half plate',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'plate',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}r5DwHJVvvUW8hwVG`,
		type: 'object',
		name: 'cloth (minor enchantment)',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'cloth',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}RcnPLTvSHAKIyrLY`,
		type: 'object',
		name: 'cloth (epic enchantment)',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'cloth',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}tit1WGPyVsjls7EN`,
		type: 'object',
		name: 'mithril plate',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'plate',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}TtYVEjoXaceUwWjl`,
		type: 'object',
		name: 'cloth (major enchantment)',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'cloth',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}uyWg3owv9dXfkQgK`,
		type: 'object',
		name: 'scale mail',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'mail',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}XPbHxDLkEN789xCf`,
		type: 'object',
		name: 'wyrmhide',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'leather',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}ysAlwyX3jdyeBn9e`,
		type: 'object',
		name: 'ox hide',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'leather',
			},
		],
	},
	{
		sourceId: `${ITEM_PREFIX}zA3N93almf9RSt34`,
		type: 'object',
		name: 'cheap hides',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'leather',
			},
		],
	},
	{
		sourceId: `${MAGIC_ITEM_PREFIX}gcHGOYfguZXCZTPz`,
		type: 'object',
		name: 'windforged mail',
		classIdentifier: '',
		writes: [
			{
				path: 'armorType',
				from: '',
				to: 'mail',
			},
		],
	},
	{
		sourceId: `${MAGIC_ITEM_PREFIX}p8tnC9CgsPaoxutj`,
		type: 'object',
		name: "frostwarden's shield",
		classIdentifier: '',
		writes: [
			{
				path: 'objectType',
				from: 'armor',
				to: 'shield',
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}3I0ZyYA1IphjlLOO`,
		type: 'spell',
		name: 'alacrity',
		classIdentifier: '',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'diXRXhoyvEcsGt88',
				identifier: '',
				label: 'Alacrity',
				predicate: {},
				priority: 1,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'After damage, gain Charged, then teleport anywhere within Range (4, +4 for each upcast).',
				useItem: true,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}eHlQWinSO4CXyqZ8`,
		type: 'spell',
		name: 'shield of justice',
		classIdentifier: '',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: '1Jort2PiuNH2yhip',
				identifier: '',
				label: 'Shield of Justice',
				predicate: {},
				priority: 1,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'Deal radiant damage back to the attacker equal to the damage you blocked (ignoring armor).',
				useItem: true,
				upcastArmor: 5,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}ISzKsGL3SwlppROJ`,
		type: 'spell',
		name: 'frost shield',
		classIdentifier: '',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'XGIXtJzj3BVrqyoq',
				identifier: '',
				label: 'Frost Shield',
				predicate: {},
				priority: 1,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder: 'Remove these temp HP at the start of your next turn.',
				useItem: true,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}mdPEulO0vYNyuGIx`,
		type: 'spell',
		name: 'dread visage',
		classIdentifier: '',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'Gcv5akLtl98FABuV',
				identifier: '',
				label: 'Dread Visage',
				predicate: {},
				priority: 1,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'Frighten melee attackers; deal 1d12 damage (+2 for each upcast) to each one that attacks you this round.',
				useItem: true,
				upcastArmor: 2,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}QHRQ64MP6g21jB6D`,
		type: 'spell',
		name: 'flame barrier',
		classIdentifier: '',
		rules: [
			{
				type: 'defendOption',
				disabled: false,
				id: 'fxPm2H5vTCF1CSl3',
				identifier: '',
				label: 'Flame Barrier',
				predicate: {},
				priority: 1,
				way: 'freeDefend',
				attackDelivery: 'any',
				outcome: 'none',
				armorBonus: '',
				useReroll: false,
				attackerCondition: '',
				reminder:
					'Until the start of your next turn, deal KEY damage (+KEY for each upcast, ignoring armor) to each melee attacker against you and give them Smoldering.',
				useItem: true,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}TFGQ4Ulp8JoT4HpL`,
		type: 'spell',
		name: 'barrier of wind',
		classIdentifier: '',
		rules: [
			{
				type: 'reroll',
				disabled: false,
				id: '4M76EwJ78lTZaTXU',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				suppressActivationCard: 'auto',
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'target',
				outcome: 'always',
				attackDelivery: 'ranged',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				rollModeChange: -1,
				primaryDieBonus: 0,
				extraDamage: '',
				automatic: false,
				discardedCritTriggers: false,
				oncePerRoll: true,
			},
			{
				type: 'defendOption',
				disabled: false,
				id: 'I2iE4FiQFEoTvUlj',
				identifier: '',
				label: 'Barrier of Wind',
				predicate: {},
				priority: 2,
				way: 'freeDefend',
				attackDelivery: 'ranged',
				outcome: 'none',
				armorBonus: '',
				useReroll: true,
				attackerCondition: '',
				reminder: 'Give each later ranged attack against you disadvantage this round.',
				useItem: true,
				upcastArmor: 3,
				withInterpose: false,
				wholeRound: false,
				range: 2,
				chargePoolIdentifier: '',
				chargeCost: 1,
				actionCost: 0,
				manaCost: 0,
				woundCost: 0,
			},
		],
	},
];

/** The document id of a copy from any pack of this system, also an older pack name. */
function packDocumentId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (!snapshotId?.startsWith(SNAPSHOT_PREFIX)) return undefined;
	const match = /\.Item\.([^.]+)$/.exec(snapshotId);
	return match?.[1];
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

/** A blank field and a missing field read the same. */
function stored(value: unknown): unknown {
	return value === undefined || value === '' ? null : value;
}

/**
 * Gives copies of the items of this work what the pack now ships: the Defend
 * option rules and their 1/encounter pools on features, ancestry bonuses and
 * spells, the reroll of Barrier of Wind, the armor type of each armor, and the
 * shield type of Frostwarden's Shield.
 *
 * A pack rule is added unless a rule with its id is there. Nothing is added
 * beside a rule of the GM's own with a type the added rules use, so an option
 * never shows twice. A field is written only while it holds the old pack value:
 * the armor type only while it is blank.
 *
 * Matched on compendium source id (the document id, so an older pack name also
 * matches), falling back to the type, the class and the name for a copy
 * stripped of one. A second run changes nothing.
 */
class Migration077DefendOptions extends MigrationBase {
	static override readonly version = 77;

	override readonly version = Migration077DefendOptions.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		const spec = this.#match(source);
		if (!spec) return;

		if (spec.rules && system.rules == null) system.rules = [];
		const rules = Array.isArray(system.rules) ? system.rules : null;

		const rulesAdded = !!spec.rules && !!rules && this.#addRules(rules, spec);
		const fieldsWritten = this.#writeFields(system, spec);

		if (!rulesAdded && !fieldsWritten) return;
		console.log(`Nimble Migration | ${source.name}: updated for Defend options`);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = this.getSourceId(source);
		const documentId = packDocumentId(sourceId);
		if (documentId) {
			return PACK_ITEMS.find(
				(spec) => spec.type === source.type && spec.sourceId.endsWith(`.Item.${documentId}`),
			);
		}
		if (isCompendiumId(toSnapshotId(sourceId))) return undefined;

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

	#writeFields(system: any, spec: PackItemSpec): boolean {
		let changed = false;
		for (const { path, from, to } of spec.writes ?? []) {
			if (!deepEquals(stored(foundry.utils.getProperty(system, path)), stored(from))) continue;
			foundry.utils.setProperty(system, path, foundry.utils.deepClone(to));
			changed = true;
		}
		return changed;
	}
}

export { Migration077DefendOptions };
