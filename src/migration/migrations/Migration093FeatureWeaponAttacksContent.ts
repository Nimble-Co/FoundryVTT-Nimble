import {
	isCompendiumId,
	SNAPSHOT_PREFIX,
	toInstalledId,
	toPackSourceId,
	toSnapshotId,
} from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type Json = Record<string, unknown>;

interface PackFeature {
	id: string;
	name: string;
	classIdentifier: string;
	/** Each changed field, by path, with the value the pack had before the change. */
	old: Record<string, unknown>;
}

const FEATURES = `${SNAPSHOT_PREFIX}nimble-class-features.Item.`;

/** Activation fields an older copy can lack. A missing one reads as its schema default. */
const SCHEMA_DEFAULTS: Record<string, unknown> = {
	'system.activation.halfRange': false,
	'system.activation.weaponAttack': '',
	'system.activation.targets.attackType': '',
	'system.activation.targets.distance': 1,
	'system.activation.targets.singleTargetAttack': false,
};

const PACK_FEATURES: PackFeature[] = [
	{
		id: 'Iv8rXY4l5fhCYhS6',
		name: 'opportunistic frenzy',
		classIdentifier: 'berserker',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'rlNrdFJy8waDYVkt',
		name: 'into the fray',
		classIdentifier: 'berserker',
		old: {
			'system.activation.effects': [],
			'system.rules': [],
		},
	},
	{
		id: 'kzVOQCSwuKKZuVCM',
		name: 'whirlwind',
		classIdentifier: 'berserker',
		old: {
			'system.activation.effects': [
				{
					id: 'wwReminderNote001',
					type: 'note',
					noteType: 'reminder',
					text: "Attack ALL targets within your melee weapon's reach.",
					parentContext: null,
					parentNode: null,
				},
			],
			'system.activation.targets.attackType': '',
			'system.activation.targets.singleTargetAttack': false,
			'system.activation.weaponAttack': '',
		},
	},
	{
		id: 'FrPigc4J5msonEaJ',
		name: 'heavy strike',
		classIdentifier: 'commander',
		old: {
			'system.activation.cost.type': 'action',
			'system.rules': [],
		},
	},
	{
		id: 'Wh8QAe0TSjpgEJFr',
		name: 'inerrant strike',
		classIdentifier: 'commander',
		old: {
			'system.activation.cost.type': 'action',
		},
	},
	{
		id: '5I3ulG74pLtLRBut',
		name: 'lunging strike',
		classIdentifier: 'commander',
		old: {
			'system.activation.cost.type': 'action',
			'system.rules': [],
		},
	},
	{
		id: 'a4y6d9VDchbMKrJn',
		name: 'sweeping strike',
		classIdentifier: 'commander',
		old: {
			'system.activation.effects': [
				{
					id: 'Prn094f0MIvEpsDS',
					type: 'note',
					noteType: 'flavor',
					text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
					parentContext: null,
					parentNode: null,
				},
			],
			'system.activation.targets.attackType': '',
			'system.activation.targets.singleTargetAttack': false,
			'system.activation.weaponAttack': '',
			'system.rules': [],
		},
	},
	{
		id: 'qbrHOGpSY2thczfu',
		name: 'master commander',
		classIdentifier: 'commander',
		old: {
			'system.rules': [
				{
					type: 'modifyPool',
					disabled: false,
					id: 'master-commander-initiative-regain',
					identifier: '',
					label: 'Master Commander: regain 1 use of Coordinated Strike when you roll Initiative',
					predicate: {},
					priority: 1,
					poolType: 'charge',
					poolIdentifier: 'coordinated-strike-uses',
					dieSize: null,
					maxDelta: null,
					addRefills: [
						{
							trigger: 'onInitiativeRolled',
							mode: 'add',
							value: '1',
							temporary: true,
							predicate: {},
						},
					],
				},
				{
					type: 'modifyPool',
					disabled: false,
					id: 'master-commander-uses-l9',
					identifier: '',
					label: 'Master Commander (2): +1 use of Coordinated Strike',
					predicate: {
						level: {
							min: 9,
						},
					},
					priority: 1,
					poolType: 'charge',
					poolIdentifier: 'coordinated-strike-uses',
					dieSize: null,
					maxDelta: '1',
				},
				{
					type: 'modifyPool',
					disabled: false,
					id: 'master-commander-uses-l13',
					identifier: '',
					label: 'Master Commander (3): +1 use of Coordinated Strike',
					predicate: {
						level: {
							min: 13,
						},
					},
					priority: 2,
					poolType: 'charge',
					poolIdentifier: 'coordinated-strike-uses',
					dieSize: null,
					maxDelta: '1',
				},
				{
					type: 'modifyPool',
					disabled: false,
					id: 'master-commander-uses-l17',
					identifier: '',
					label: 'Master Commander (4): +1 use of Coordinated Strike',
					predicate: {
						level: {
							min: 17,
						},
					},
					priority: 3,
					poolType: 'charge',
					poolIdentifier: 'coordinated-strike-uses',
					dieSize: null,
					maxDelta: '1',
				},
			],
		},
	},
	{
		id: 'V66ATYkNUXDrrCf3',
		name: 'juggernaut',
		classIdentifier: 'commander',
		old: {
			'system.rules': [
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
		},
	},
	{
		id: 'O0iwveCk3zoyRuF9',
		name: 'shield expert',
		classIdentifier: 'commander',
		old: {
			'system.rules': [
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
					attackerEffectId: '',
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
	},
	{
		id: 'tl9VgnTSZegiQLyp',
		name: 'as one!',
		classIdentifier: 'commander',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'UOx9MGeTyXGK9iEh',
		name: 'experienced commander.',
		classIdentifier: 'commander',
		old: {
			'system.rules': [
				{
					type: 'modifyPool',
					disabled: false,
					id: 'experienced-commander-uses',
					identifier: '',
					label: 'Experienced Commander: +1 use of Coordinated Strike',
					predicate: {},
					priority: 1,
					poolType: 'charge',
					poolIdentifier: 'coordinated-strike-uses',
					dieSize: null,
					maxDelta: '1',
				},
			],
		},
	},
	{
		id: 'tBBwkxBjmHarCgPU',
		name: 'withering strike',
		classIdentifier: 'commander',
		old: {
			'system.activation.effects': [
				{
					id: 'R58atqyuNOS6xAUe',
					type: 'applyEffect',
					effectId: 'ek1iEr1yAJm5bkIe',
					recipient: 'targets',
					tempHealingNodeId: null,
					parentContext: null,
					parentNode: null,
				},
			],
			'system.rules': [],
		},
	},
	{
		id: '6xpILHYt5KTSnTtd',
		name: 'coordinated strike!',
		classIdentifier: 'commander',
		old: {
			'system.activation.effects': [
				{
					id: '0gbDXjqJDZcUxjNB',
					type: 'note',
					noteType: 'reminder',
					text: 'You and the targeted ally each attack for free. The ally may cast a cantrip instead; only the weapon attack is offered on this card.',
					parentContext: null,
					parentNode: null,
				},
			],
			'system.rules': [
				{
					type: 'chargePool',
					disabled: false,
					id: 'coordinated-strike-uses-pool',
					identifier: 'coordinated-strike-uses',
					label: 'Coordinated Strike uses',
					predicate: {},
					priority: 1,
					scope: 'item',
					max: 'max(@intelligence, 0)',
					dieSize: null,
					initial: 'max',
					recoveries: [
						{
							trigger: 'safeRest',
							mode: 'refresh',
							value: '1',
						},
					],
					hidden: false,
				},
				{
					type: 'chargePool',
					disabled: false,
					id: 'coordinated-strike-round-pool',
					identifier: 'coordinated-strike-round',
					label: 'Coordinated Strike (once per round)',
					predicate: {},
					priority: 1,
					scope: 'item',
					max: '1',
					dieSize: null,
					initial: 'max',
					recoveries: [
						{
							trigger: 'onTurnStart',
							mode: 'refresh',
							value: '1',
						},
						{
							trigger: 'encounterEnd',
							mode: 'refresh',
							value: '1',
						},
					],
					hidden: true,
				},
				{
					type: 'chargePool',
					disabled: false,
					id: 'coordinated-strike-encounter-pool',
					identifier: 'coordinated-strike-encounter',
					label: 'Coordinated Strike (first use each encounter)',
					predicate: {
						level: {
							min: 18,
						},
					},
					priority: 1,
					scope: 'item',
					max: '1',
					dieSize: null,
					initial: 'max',
					recoveries: [
						{
							trigger: 'encounterStart',
							mode: 'refresh',
							value: '1',
						},
					],
					hidden: true,
				},
				{
					type: 'chargeConsumer',
					disabled: false,
					id: 'coordinated-strike-uses-consumer',
					identifier: '',
					label: '',
					predicate: {},
					priority: 2,
					poolIdentifier: 'coordinated-strike-uses',
					poolScope: 'item',
					cost: '1',
				},
				{
					type: 'chargeConsumer',
					disabled: false,
					id: 'coordinated-strike-round-consumer',
					identifier: '',
					label: '',
					predicate: {},
					priority: 2,
					poolIdentifier: 'coordinated-strike-round',
					poolScope: 'item',
					cost: '1',
				},
				{
					type: 'chargeConsumer',
					disabled: false,
					id: 'coordinated-strike-encounter-consumer',
					identifier: '',
					label: '',
					predicate: {
						level: {
							min: 18,
						},
						'self:coordinated-strike-encounterChargePool': {
							min: 1,
						},
					},
					priority: 2,
					poolIdentifier: 'coordinated-strike-encounter',
					poolScope: 'item',
					cost: '1',
				},
				{
					type: 'grantActivation',
					disabled: false,
					id: 'coordinated-strike-ally-attack',
					identifier: '',
					label: 'Coordinated Strike',
					predicate: {},
					priority: 3,
					activationType: 'weaponAttack',
					includesUser: true,
				},
				{
					type: 'actionDelta',
					disabled: false,
					id: 'coordinated-strike-self-free-attack',
					identifier: '',
					label: 'Coordinated Strike (your attack is free)',
					predicate: {},
					priority: 3,
					value: '1',
					timing: 'now',
					target: 'self',
					borrowFromNextTurn: false,
				},
				{
					type: 'actionDelta',
					disabled: false,
					id: 'coordinated-strike-ally-free-attack',
					identifier: '',
					label: 'Coordinated Strike (ally attack is free)',
					predicate: {},
					priority: 3,
					value: '1',
					timing: 'now',
					target: 'targeted',
					borrowFromNextTurn: false,
				},
				{
					type: 'actionDelta',
					disabled: false,
					id: 'coordinated-strike-as-one',
					identifier: '',
					label: 'As One! (allies gain an action next turn)',
					predicate: {
						subclass: 'champion-of-the-vanguard',
						level: {
							min: 15,
						},
					},
					priority: 4,
					value: '1',
					timing: 'nextTurn',
					target: 'targeted',
					borrowFromNextTurn: false,
				},
				{
					type: 'freeMove',
					disabled: false,
					id: 'coordinated-strike-advance-free-move',
					identifier: '',
					label: 'Advance!',
					predicate: {
						subclass: 'champion-of-the-vanguard',
						level: {
							min: 3,
						},
					},
					priority: 4,
					trigger: 'onActivation',
					poolIdentifier: '',
					distance: 'floor(@speed / 2)',
					recipient: 'selfAndAllies',
					within: 12,
					direction: 'any',
					ignoresDifficultTerrain: false,
					chargePoolIdentifier: '',
				},
				{
					type: 'actionDelta',
					disabled: false,
					id: 'coordinated-strike-unparalleled-tactics',
					identifier: '',
					label: 'Unparalleled Tactics (ally gains an action next turn)',
					predicate: {
						level: {
							min: 18,
							max: 19,
						},
						'self:coordinated-strike-encounterChargePool': {
							min: 1,
						},
					},
					priority: 4,
					value: '1',
					timing: 'nextTurn',
					target: 'targeted',
					borrowFromNextTurn: false,
				},
				{
					type: 'actionDelta',
					disabled: false,
					id: 'coordinated-strike-captain-of-legions',
					identifier: '',
					label: 'Captain of Legions (all allies gain an action next turn)',
					predicate: {
						level: {
							min: 20,
						},
						'self:coordinated-strike-encounterChargePool': {
							min: 1,
						},
					},
					priority: 4,
					value: '1',
					timing: 'nextTurn',
					target: 'allAllies',
					borrowFromNextTurn: false,
				},
			],
		},
	},
	{
		id: 'yJqf7nEqz1UBi03b',
		name: 'no escape',
		classIdentifier: 'hunter',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'GsvjYgKhH4FoogG0',
		name: 'roll & strike',
		classIdentifier: 'hunter',
		old: {
			'system.activation.effects': [],
			'system.rules': [],
		},
	},
	{
		id: '2bB8Ro9sb86nuvJb',
		name: 'unparalleled survivalist',
		classIdentifier: 'hunter',
		old: {
			'system.rules': [],
		},
	},
	{
		id: '4xJDeF5FpN828c4N',
		name: 'hail of arrows',
		classIdentifier: 'hunter',
		old: {
			'system.activation.halfRange': false,
		},
	},
	{
		id: '7rZG0gw3fUgYjRAA',
		name: 'heavy shot',
		classIdentifier: 'hunter',
		old: {
			'system.activation.halfRange': false,
		},
	},
	{
		id: 'pFLk0QONXyFNM6Pm',
		name: 'incendiary shot',
		classIdentifier: 'hunter',
		old: {
			'system.activation.halfRange': false,
		},
	},
	{
		id: 'bz5zsuu2Prjb79mq',
		name: 'multishot',
		classIdentifier: 'hunter',
		old: {
			'system.activation.halfRange': false,
		},
	},
	{
		id: 'sh2FNsOMbAgEZSVh',
		name: 'vital shot',
		classIdentifier: 'hunter',
		old: {
			'system.activation.halfRange': false,
		},
	},
	{
		id: 'MxCKm6hlaJqSSG8o',
		name: 'bonescythe',
		classIdentifier: 'shadowmancer',
		old: {
			'system.activation.effects': [],
			'system.activation.targets.attackType': '',
			'system.activation.targets.distance': 1,
			'system.identifier': '',
		},
	},
	{
		id: 'fFrCgIQX8mfmHKUB',
		name: 'grim harrow',
		classIdentifier: 'shadowmancer',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'oGxqGWjCnjmf0mLw',
		name: 'assist me, my friend!',
		classIdentifier: 'shepherd',
		old: {
			'system.rules': [
				{
					type: 'conditionalBonus',
					disabled: false,
					id: 'YxlrHitpIxVvLld3',
					identifier: '',
					label: 'Assist Me, My Friend!',
					predicate: {},
					priority: 1,
					advantage: 0,
					damageBonus: '',
					damageType: '',
					damageOfItem: 'lifebinding-spirit',
					startsChosen: false,
					delivery: 'melee',
					source: 'any',
					targetCondition: {},
					doubleFor: [],
				},
			],
		},
	},
	{
		id: 'bgmLWfuqmytGV3k3',
		name: "how'd you get here?!",
		classIdentifier: 'the-cheat',
		old: {
			'system.activation.effects': [],
			'system.rules': [],
		},
	},
	{
		id: 'JiNcaklfRjgJ7e5W',
		name: 'fit for any battlefield',
		classIdentifier: 'commander',
		old: {
			'system.rules': [
				{
					type: 'grantItem',
					disabled: false,
					id: 'OCPNZWXtQjoVmJsW',
					identifier: 'Commander-lvl3-Choose a Combat Tactic',
					label: 'Choose a Combat Tactic',
					predicate: {},
					priority: 1,
					allowDuplicate: true,
					inMemoryOnly: false,
					uuid: 'Item.iICGKEwphgLbJY8i',
				},
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
					recoveries: [
						{
							trigger: 'onInitiativeRolled',
							mode: 'refresh',
							value: '1',
						},
						{
							trigger: 'encounterEnd',
							mode: 'set',
							value: '0',
						},
					],
				},
				{
					type: 'modifyPool',
					disabled: false,
					id: 'combat-dice-d8-l5',
					identifier: '',
					label: 'Combat Dice → d8',
					predicate: {
						level: {
							min: 5,
						},
					},
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
					predicate: {
						level: {
							min: 9,
						},
					},
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
					predicate: {
						level: {
							min: 13,
						},
					},
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
					predicate: {
						level: {
							min: 17,
						},
					},
					priority: 6,
					poolType: 'charge',
					poolIdentifier: 'combat-dice',
					dieSize: 'd20',
					maxDelta: null,
				},
			],
		},
	},
	{
		id: 'gCkxDNXKLhgO3EU8',
		name: 'trickshot',
		classIdentifier: 'the-cheat',
		old: {
			'system.activation.effects': [],
			'system.rules': [],
		},
	},
	{
		id: 'VqMwiol43RCzWXNf',
		name: 'quickstrike',
		classIdentifier: 'zephyr',
		old: {
			'system.activation.effects': [
				{
					id: 'lTyPeYJqp7me1BEg',
					type: 'note',
					noteType: 'reminder',
					text: 'When you Interpose, make an unarmed strike against that enemy for free.',
					parentContext: null,
					parentNode: null,
				},
			],
			'system.rules': [
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
						{
							trigger: 'onTurnEnd',
							mode: 'refresh',
							value: '1',
						},
						{
							trigger: 'encounterEnd',
							mode: 'refresh',
							value: '1',
						},
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
			],
		},
	},
	{
		id: 'bIqEghM1BkChlRJD',
		name: 'burst of speed',
		classIdentifier: 'zephyr',
		old: {
			'system.identifier': '',
			'system.rules': [
				{
					type: 'chargePool',
					disabled: false,
					id: '0LC1CfBCCPWhE36H',
					identifier: 'burst-of-speed',
					label: 'Bursts of Speed',
					predicate: {},
					priority: 1,
					scope: 'item',
					max: '99',
					dieSize: null,
					initial: 'zero',
					hidden: false,
					showAsResource: true,
					hideMax: true,
					recoveries: [
						{
							trigger: 'onInitiativeRolled',
							mode: 'set',
							value: '@dexterity',
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
					attackerEffectId: '',
					reminder: '',
					useItem: false,
					withInterpose: false,
					wholeRound: false,
					range: 2,
					chargePoolIdentifier: 'burst-of-speed',
					chargeCost: 1,
					actionCost: 0,
					oncePerTurn: true,
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
					attackerEffectId: '',
					reminder: '',
					useItem: false,
					withInterpose: false,
					wholeRound: true,
					range: 2,
					chargePoolIdentifier: 'burst-of-speed',
					chargeCost: 1,
					actionCost: 0,
					oncePerTurn: true,
					manaCost: 0,
					woundCost: 0,
				},
			],
		},
	},
	{
		id: 'g6mazFgBY7eK7AyV',
		name: 'echoed agony',
		classIdentifier: 'zephyr',
		old: {
			'system.rules': [],
		},
	},
	{
		id: 'V7oa3Y3bb9UMorXn',
		name: 'share my pain',
		classIdentifier: 'zephyr',
		old: {
			'system.rules': [],
		},
	},
];

const BY_ID = new Map(PACK_FEATURES.map((feature) => [feature.id, feature]));

const ULVEK = `${SNAPSHOT_PREFIX}nimble-legendary-monsters.Actor.WnnjaFQVSMGeqIIT`;

const CONTROL = {
	uuid: `${ULVEK}.Item.g8iXvv4kfJOpATGy`,
	id: 'g8iXvv4kfJOpATGy',
	name: 'control.',
	actorName: "ul'vek, psionic despot",
	old: { 'system.rules': [] } as Record<string, unknown>,
};

const CLANGER = `${SNAPSHOT_PREFIX}nimble-monsters.Actor.AH1S3PuQDAlqGd9x`;

const NOOOOO_ID = 'kCl4ngrN0oooo0Ab';

const NOOOOO = `${CLANGER}.Item.${NOOOOO_ID}`;

function isRecord(value: unknown): value is Json {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nameOf(source: Json): string {
	return typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
}

/** The value with its object keys in order, so two values compare by content. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonical(value[key])]),
		);
	}
	return value;
}

function sameContent(a: unknown, b: unknown): boolean {
	return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Gives a copy of a pack feature that changed for feature weapon attacks the new pack value of
 * each changed field (rules, activation steps, weapon attack, half range, targets, activation
 * cost and identifier). The copy changes only when every changed field still has the old pack
 * value; a copy with a hand edit in one of them stays as it is.
 *
 * A class feature copy is matched by its compendium id, or with no compendium id by its name and
 * class. The Control feature of Ul'vek is matched by the actor's compendium id (or name) and the
 * item's id or name. A Kobold Clanger monster with no Nooooo! gets it from the pack.
 * A pack item that cannot be read throws, so the Migration Report lists the document.
 */
class Migration093FeatureWeaponAttacksContent extends MigrationBase {
	static override readonly version = 93;

	override readonly version = Migration093FeatureWeaponAttacksContent.version;

	override readonly title = 'Feature weapon attacks content';

	override readonly kind: MigrationKind = 'content';

	#packSources = new Map<string, Promise<Json>>();

	override async updateActor(source: any): Promise<void> {
		if (!isRecord(source) || !Array.isArray(source.items) || !this.#isClanger(source)) return;
		const items = source.items.filter(isRecord);
		if (items.some((item) => this.#isNoooooo(item))) return;

		const pack = await this.#packSource(NOOOOO);
		if (pack.type !== 'monsterFeature') return;
		const added = foundry.utils.deepClone(pack);
		added._id = NOOOOO_ID;
		source.items.push(added);
		console.log(`Nimble Migration | ${source.name}: Nooooo! from the pack`);
	}

	#isClanger(source: Json): boolean {
		if (source.type !== 'npc') return false;
		const sourceId = toSnapshotId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) return sourceId === CLANGER;
		return nameOf(source) === 'kobold clanger';
	}

	#isNoooooo(item: Json): boolean {
		if (item._id === NOOOOO_ID) return true;
		return item.type === 'monsterFeature' && /^no{2,}[!.]*$/.test(nameOf(item));
	}

	override async updateItem(source: any, parent?: any): Promise<void> {
		if (!isRecord(source) || !isRecord(source.system)) return;
		if (source.type === 'feature') {
			const feature = this.#matchFeature(source);
			if (feature) await this.#refresh(source, `${FEATURES}${feature.id}`, feature.old);
		} else if (source.type === 'monsterFeature' && this.#isControl(source, parent)) {
			await this.#refresh(source, CONTROL.uuid, CONTROL.old);
		}
	}

	#matchFeature(source: Json): PackFeature | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) {
			return sourceId?.startsWith(FEATURES)
				? BY_ID.get(sourceId.slice(FEATURES.length))
				: undefined;
		}
		const name = nameOf(source);
		const classIdentifier = (source.system as Json).class;
		return PACK_FEATURES.find(
			(feature) => feature.name === name && feature.classIdentifier === classIdentifier,
		);
	}

	#isControl(source: Json, parent: unknown): boolean {
		const sourceId = toSnapshotId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) return sourceId === CONTROL.uuid;
		if (!isRecord(parent)) return false;
		const actorId = toSnapshotId(this.getSourceId(parent));
		const isUlvek = isCompendiumId(actorId)
			? actorId === ULVEK
			: nameOf(parent) === CONTROL.actorName;
		return isUlvek && (source._id === CONTROL.id || nameOf(source) === CONTROL.name);
	}

	async #refresh(source: Json, uuid: string, old: Record<string, unknown>): Promise<void> {
		const paths = Object.keys(old);
		const stillOld = (path: string) =>
			sameContent(foundry.utils.getProperty(source, path) ?? SCHEMA_DEFAULTS[path], old[path]);
		if (!paths.every(stillOld)) return;

		const pack = await this.#packSource(uuid);
		if (pack.type !== source.type) return;
		const values = paths.map((path) => foundry.utils.getProperty(pack, path));
		if (values.some((value) => value === undefined)) return;
		paths.forEach((path, index) => {
			foundry.utils.setProperty(source, path, foundry.utils.deepClone(values[index]));
		});
		console.log(`Nimble Migration | ${source.name}: new pack ${paths.join(', ')}`);
	}

	/** The pack item's data. Throws when it cannot be read. */
	#packSource(uuid: string): Promise<Json> {
		let found = this.#packSources.get(uuid);
		if (!found) {
			found = (async () => {
				const doc = (await fromUuid(toInstalledId(uuid) as never)) as {
					toObject?: () => unknown;
				} | null;
				const data = typeof doc?.toObject === 'function' ? doc.toObject() : null;
				if (!isRecord(data)) throw new Error(`093 could not read ${uuid}`);
				return data;
			})();
			this.#packSources.set(uuid, found);
		}
		return found;
	}
}

export { Migration093FeatureWeaponAttacksContent };
