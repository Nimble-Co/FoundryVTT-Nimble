import { isCompendiumId, toPackSourceId, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

/** A path of the item's system, written only while it still holds `from`. */
interface FieldWrite {
	path: string;
	from: unknown;
	to: unknown;
}

interface ItemChanges {
	/** Rules the pack shipped before, so these do not count as the GM's own. */
	shippedRuleIds?: string[];
	rules?: RuleSource[];
	/** Written only while the rule still holds every value of `old`. */
	ruleChange?: { old: RuleSource; field: string; to: unknown };
	writes?: FieldWrite[];
}

interface PackItemSpec extends ItemChanges {
	sourceId: string;
	type: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	classIdentifier: string;
}

interface MonsterSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	items: (ItemChanges & { name: string })[];
}

const _FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.ucJYSFE6x1a7G3Ko',
		type: 'feature',
		name: 'rampage',
		classIdentifier: 'berserker',
		rules: [
			{
				type: 'keepAmount',
				disabled: false,
				id: 'rampageKeepAmoun',
				identifier: 'rampage',
				label: 'Rampage',
				predicate: {},
				priority: 1,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Nx9BK3e0lNPPYL45',
		type: 'feature',
		name: 'final takedown',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'attackOutcome',
				disabled: false,
				id: 'finalTakedownCri',
				identifier: '',
				label: 'Final Takedown',
				predicate: {},
				priority: 1,
				side: 'yourAttacks',
				cannotMiss: false,
				critRange: 0,
				forceCrit: 'always',
				ignoreArmor: false,
				anyDieCrits: false,
				critD20: false,
				viciousCrits: false,
				attackDelivery: 'any',
				thisItemOnly: true,
				attackSource: 'any',
				exceptItemIdentifier: '',
				otherCreature: {},
				chargePoolIdentifier: '',
			},
			{
				type: 'critBack',
				disabled: false,
				id: 'finalTakedownBac',
				identifier: '',
				label: 'Final Takedown',
				predicate: {},
				priority: 1,
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'finalTakedownCon',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'finalTakedownDmg',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'finalTakedownDmgFull',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'finalTakedownDmg',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'reach',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'melee',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.iDYdYYMzgculnANa',
		type: 'feature',
		name: "hunter's mark",
		classIdentifier: 'hunter',
		shippedRuleIds: ['hunters-mark-bonus', 'hunters-mark-hidden', 'hunters-mark-toggle'],
		ruleChange: {
			old: {
				type: 'conditionalBonus',
				disabled: false,
				id: 'hunters-mark-bonus',
				identifier: '',
				label: "Hunter's Mark",
				predicate: {},
				priority: 1,
				advantage: 1,
				damageBonus: '@level',
				damageType: '',
				delivery: 'any',
				source: 'any',
				targetCondition: {
					$and: ['target:quarry'],
				},
			},
			field: 'doubleFor',
			to: [
				{
					source: 'final-takedown',
					onlyNoArmor: false,
				},
				{
					source: 'vital-shot',
					onlyNoArmor: true,
				},
			],
		},
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.i3O9fe7mzp4ApOUm',
		type: 'feature',
		name: 'thrill of the hunt',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'thrillOfTheHuntP',
				identifier: 'thrill-of-the-hunt',
				label: 'Thrill of the Hunt',
				predicate: {},
				priority: 1,
				scope: 'actor',
				max: '99',
				dieSize: null,
				initial: 'zero',
				hidden: false,
				showAsResource: true,
				recoveries: [
					{
						trigger: 'onMarkedDeath',
						mode: 'add',
						value: '1',
						temporary: false,
						notWhenSpent: true,
						needsFeatureEffects: true,
						predicate: {
							$and: ['target:quarry'],
						},
					},
					{
						trigger: 'onHit',
						mode: 'add',
						value: '1',
						temporary: false,
						notWhenSpent: true,
						needsFeatureEffects: true,
						predicate: {
							$and: ['target:quarry', 'attack:melee'],
						},
					},
					{
						trigger: 'onCriticalHit',
						mode: 'add',
						value: '1',
						temporary: false,
						notWhenSpent: true,
						needsFeatureEffects: true,
						predicate: {
							$and: ['target:quarry', 'attack:ranged'],
						},
					},
					{
						trigger: 'encounterEnd',
						mode: 'set',
						value: '0',
						temporary: false,
						notWhenSpent: false,
						needsFeatureEffects: false,
						predicate: {},
					},
				],
				hideMax: true,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.EshmHQJILEYHpkO4',
		type: 'feature',
		name: 'veteran stalker',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'veteranStalkerGa',
				identifier: '',
				label: 'Veteran Stalker',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'thrill-of-the-hunt',
				dieSize: null,
				maxDelta: '0',
				addRefills: [
					{
						trigger: 'onBloodied',
						mode: 'add',
						value: '1',
						temporary: false,
						notWhenSpent: false,
						needsFeatureEffects: true,
						predicate: {},
					},
					{
						trigger: 'onWound',
						mode: 'add',
						value: '1',
						temporary: false,
						notWhenSpent: false,
						needsFeatureEffects: true,
						predicate: {},
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Bf6LEraULqTD1gNm',
		type: 'feature',
		name: 'wild endurance',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'wildEnduranceGai',
				identifier: '',
				label: 'Wild Endurance',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'thrill-of-the-hunt',
				dieSize: null,
				maxDelta: '0',
				addRefills: [
					{
						trigger: 'onTurnStart',
						mode: 'add',
						value: '1',
						temporary: false,
						notWhenSpent: false,
						needsFeatureEffects: true,
						predicate: {},
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.krKkYldIiY2pnLVe',
		type: 'feature',
		name: 'apex predator',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'apexPredatorGain',
				identifier: '',
				label: 'Apex Predator',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'thrill-of-the-hunt',
				dieSize: null,
				maxDelta: '0',
				addRefills: [
					{
						trigger: 'onInitiativeRolled',
						mode: 'add',
						value: '1',
						temporary: false,
						notWhenSpent: false,
						needsFeatureEffects: true,
						predicate: {},
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.52Ei2iPJV30tqpJ6',
		type: 'feature',
		name: 'addling arrow',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'addlingConsumer0',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
			{
				type: 'holdOnTarget',
				disabled: false,
				id: 'addlingHoldNext0',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				heldKind: 'mustAttackOther',
				damageType: '',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'addlingArrowD000',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'addlingArrowD000Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'addlingArrowD000',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.cVCXTSAnBBFSmVnS',
		type: 'feature',
		name: 'come get some!',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'comeGetSomeConsu',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'comeGetSomeDmg00',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'comeGetSomeDmg00Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'comeGetSomeDmg00',
								},
								{
									id: 'comeGetSomeDmg00C0',
									type: 'condition',
									condition: 'taunted',
									parentContext: 'hit',
									parentNode: 'comeGetSomeDmg00',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'reach',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'any',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.uj7u8scrrKO3fqyD',
		type: 'feature',
		name: 'fleet feet',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'fleetFeetConsume',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.vGuNZrx0q2FuQes1',
		type: 'feature',
		name: 'grease trap',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'greaseTrapPool00',
				identifier: 'grease-trap-use',
				label: 'Grease Trap (1/encounter)',
				predicate: {},
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
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'greaseTrapPool0U',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'grease-trap-use',
				poolScope: 'item',
				cost: '1',
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'greaseTrapConsum',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
			{
				type: 'holdOnTarget',
				disabled: false,
				id: 'greaseVulnFire00',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				heldKind: 'vulnerableOnce',
				damageType: 'fire',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'greaseTrapConsum0',
						type: 'condition',
						condition: 'prone',
						parentContext: null,
						parentNode: null,
					},
					{
						id: 'greaseTrapConsum1',
						type: 'condition',
						condition: 'smoldering',
						parentContext: null,
						parentNode: null,
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.4xJDeF5FpN828c4N',
		type: 'feature',
		name: 'hail of arrows',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'hailConsumer0000',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.acquireTargetsFromTemplate',
				from: false,
				to: true,
			},
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'hailOfArrowsDmg0',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: false,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'hailOfArrowsDmg0Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'hailOfArrowsDmg0',
								},
								{
									id: 'hailOfArrowsDmg0C0',
									type: 'condition',
									condition: 'slowed',
									parentContext: 'hit',
									parentNode: 'hailOfArrowsDmg0',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.template',
				from: {
					length: 1,
					radius: 1,
					shape: '',
					width: 1,
				},
				to: {
					length: 1,
					radius: 1,
					shape: 'square',
					width: 3,
				},
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.7rZG0gw3fUgYjRAA',
		type: 'feature',
		name: 'heavy shot',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'heavyShotConsume',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'heavyShotDamage0',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'heavyShotDamage0Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'heavyShotDamage0',
								},
								{
									id: 'heavyShotPush0000',
									type: 'move',
									kind: 'forced',
									recipient: 'targets',
									distance: '0',
									distanceBySize: {
										tiny: '4',
										small: '4',
										medium: '2',
										large: '1',
									},
									ignoreDifficultTerrain: true,
									direction: 'away',
									parentContext: 'hit',
									parentNode: 'heavyShotDamage0',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.pFLk0QONXyFNM6Pm',
		type: 'feature',
		name: 'incendiary shot',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'incendiaryConsum',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'incendiaryShotD0',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'incendiaryShotD0Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'incendiaryShotD0',
								},
							],
						},
					},
					{
						id: 'incendiaryFireD0',
						type: 'damage',
						damageType: 'fire',
						formula: '(@will)d8',
						canCrit: false,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'incendiaryFireD0Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'incendiaryFireD0',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.bz5zsuu2Prjb79mq',
		type: 'feature',
		name: 'multishot',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'multishotConsume',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'multishotDamage0',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'multishotDamage0Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'multishotDamage0',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.targets.count',
				from: 1,
				to: 2,
			},
			{
				path: 'activation.targets.singleTargetAttack',
				from: null,
				to: true,
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.b1ONYT54cxhN5G0T',
		type: 'feature',
		name: 'pinning shot',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'pinningConsumer0',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'pinningShotDmg00',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'pinningShotDmg00Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'pinningShotDmg00',
								},
								{
									id: 'pinningShotDmg00C0',
									type: 'condition',
									condition: 'restrained',
									parentContext: 'hit',
									parentNode: 'pinningShotDmg00',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.nNRo9ohAHsyQfs7r',
		type: 'feature',
		name: 'sharpshooter',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'sharpshootConsum',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
			{
				type: 'damageMultiplier',
				disabled: false,
				id: 'sharpshootDouble',
				identifier: '',
				label: 'you have not moved this turn, and your quarry is 4 or more spaces away',
				predicate: {},
				priority: 1,
				multiplier: 2,
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'sharpshooterDmg0',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'sharpshooterDmg0Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'sharpshooterDmg0',
								},
							],
						},
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.rt2O6NhLTipHYDs0',
		type: 'feature',
		name: 'snare trap',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'snareTrapPool000',
				identifier: 'snare-trap-use',
				label: 'Snare Trap (1/encounter)',
				predicate: {},
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
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'snareTrapPool00U',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'snare-trap-use',
				poolScope: 'item',
				cost: '1',
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'snareTrapConsume',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'snareTrapMoveBack',
						type: 'move',
						kind: 'forced',
						recipient: 'targets',
						distance: '1',
						distanceBySize: {},
						ignoreDifficultTerrain: true,
						direction: 'any',
						parentContext: null,
						parentNode: null,
					},
					{
						id: 'snareTrapConsume0',
						type: 'condition',
						condition: 'restrained',
						parentContext: null,
						parentNode: null,
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.sh2FNsOMbAgEZSVh',
		type: 'feature',
		name: 'vital shot',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'vitalShotConsume',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'thrill-of-the-hunt',
				poolScope: 'actor',
				cost: '1',
			},
		],
		writes: [
			{
				path: 'activation.effects',
				from: [],
				to: [
					{
						id: 'vitalShotDamage0',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'vitalShotDamage0Full',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentContext: 'hit',
									parentNode: 'vitalShotDamage0',
								},
							],
						},
						ignoreArmor: true,
					},
				],
			},
			{
				path: 'activation.targets.attackType',
				from: null,
				to: 'range',
			},
			{
				path: 'activation.weaponAttack',
				from: null,
				to: 'ranged',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.lmvY8btW5lyQkvbU',
		type: 'feature',
		name: 'wild instinct',
		classIdentifier: 'hunter',
		rules: [
			{
				type: 'freeAssess',
				disabled: false,
				id: 'wildInstinctAsse',
				identifier: '',
				label: 'Wild Instinct',
				predicate: {},
				priority: 1,
				chargePoolIdentifier: 'thrill-of-the-hunt',
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.vm04u7ZkH2tUbkoc',
		type: 'feature',
		name: 'deny fate',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'optionWindow',
				disabled: false,
				id: 'denyFateCardRow0',
				identifier: '',
				label: 'Deny Fate',
				predicate: {},
				priority: 1,
				optionSet: 'control',
				opensOnUse: false,
				oncePerRound: false,
				cardRow: true,
				ignoresDisadvantage: false,
				triggerTwice: false,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.pvK6JM4xk9vqc28w',
		type: 'feature',
		name: 'force of will',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'optionWindow',
				disabled: false,
				id: 'forceOfWillOpens',
				identifier: '',
				label: 'Force of Will',
				predicate: {},
				priority: 1,
				optionSet: 'control',
				opensOnUse: true,
				oncePerRound: true,
				cardRow: false,
				ignoresDisadvantage: false,
				triggerTwice: false,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.alpqbmQnF94N1KFw',
		type: 'feature',
		name: 'nullify',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'nullifyUsePool00',
				identifier: 'nullify-use',
				label: 'Nullify (1/encounter)',
				predicate: {},
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
			},
			{
				type: 'chargeConsumer',
				disabled: false,
				id: 'nullifyUseConsum',
				identifier: '',
				label: '',
				predicate: {},
				priority: 2,
				poolIdentifier: 'nullify-use',
				poolScope: 'item',
				cost: '1',
			},
			{
				type: 'optionWindow',
				disabled: false,
				id: 'nullifyOpensCont',
				identifier: '',
				label: 'Nullify',
				predicate: {},
				priority: 1,
				optionSet: 'control',
				opensOnUse: true,
				oncePerRound: false,
				cardRow: false,
				ignoresDisadvantage: true,
				triggerTwice: false,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.cCqrZ6XZBRiMhwdh',
		type: 'feature',
		name: 'supreme control',
		classIdentifier: 'mage',
		rules: [
			{
				type: 'optionWindow',
				disabled: false,
				id: 'supremeControlTw',
				identifier: '',
				label: 'Supreme Control',
				predicate: {},
				priority: 1,
				optionSet: 'control',
				opensOnUse: false,
				oncePerRound: false,
				cardRow: false,
				ignoresDisadvantage: false,
				triggerTwice: true,
			},
		],
	},
];

const MONSTERS: MonsterSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-legendary-monsters.Actor.ZtvN9z6ZEolYZu1R',
		name: 'azriel, lord of pain & flame',
		items: [
			{
				name: 'pain!',
				rules: [
					{
						type: 'attackOutcome',
						disabled: false,
						id: 'azrielPainVicio0',
						identifier: '',
						label: 'PAIN!',
						predicate: {},
						priority: 1,
						side: 'attacksAgainstYou',
						cannotMiss: false,
						critRange: 0,
						forceCrit: 'none',
						ignoreArmor: false,
						anyDieCrits: false,
						critD20: false,
						viciousCrits: true,
						attackDelivery: 'any',
						thisItemOnly: false,
						attackSource: 'any',
						exceptItemIdentifier: '',
						otherCreature: {},
						chargePoolIdentifier: '',
					},
					{
						type: 'damageBack',
						disabled: false,
						id: 'azrielPainBack00',
						identifier: '',
						label: 'PAIN!',
						predicate: {},
						priority: 1,
						onlyCrits: true,
						amount: 'critDice',
						woundDoubles: false,
					},
				],
			},
			{
				name: 'last stand',
				rules: [
					{
						type: 'attackOutcome',
						disabled: false,
						id: 'azrielLastStand0',
						identifier: '',
						label: 'Last Stand',
						predicate: {
							$and: ['self:lastStand'],
						},
						priority: 1,
						side: 'attacksAgainstYou',
						cannotMiss: false,
						critRange: 0,
						forceCrit: 'onHit',
						ignoreArmor: false,
						anyDieCrits: false,
						critD20: false,
						viciousCrits: false,
						attackDelivery: 'any',
						thisItemOnly: false,
						attackSource: 'any',
						exceptItemIdentifier: '',
						otherCreature: {},
						chargePoolIdentifier: '',
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-legendary-monsters.Actor.7n4NFalMBVr8hKaP',
		name: 'dravok, all-seeing tyrant',
		items: [
			{
				name: 'terrible maw',
				rules: [
					{
						type: 'attackOutcome',
						disabled: false,
						id: 'dravokTerribleMw',
						identifier: '',
						label: 'Terrible Maw',
						predicate: {},
						priority: 1,
						side: 'yourAttacks',
						cannotMiss: false,
						critRange: 0,
						forceCrit: 'none',
						ignoreArmor: false,
						anyDieCrits: true,
						critD20: false,
						viciousCrits: true,
						attackDelivery: 'any',
						thisItemOnly: true,
						attackSource: 'any',
						exceptItemIdentifier: '',
						otherCreature: {},
						chargePoolIdentifier: '',
					},
				],
				writes: [
					{
						path: 'activation.effects',
						from: [
							{
								id: 'SqqL7WHNreF474eJ',
								type: 'damage',
								damageType: 'piercing',
								formula: '1d4x+1d4x+1d4x+1d4x',
								parentContext: null,
								parentNode: null,
								canCrit: true,
								canMiss: true,
								on: {
									hit: [
										{
											id: 'G811z6HFSAyW7uzA',
											type: 'note',
											noteType: 'warning',
											text: '[Vicious not modeled]\nFor every 4 rolled, roll an extra 1d4',
											parentContext: 'hit',
											parentNode: 'SqqL7WHNreF474eJ',
										},
										{
											id: 'a3P1uHz3p99oSEW8',
											type: 'damageOutcome',
											outcome: 'fullDamage',
											parentContext: 'hit',
											parentNode: 'SqqL7WHNreF474eJ',
										},
									],
								},
							},
						],
						to: [
							{
								id: 'SqqL7WHNreF474eJ',
								type: 'damage',
								damageType: 'piercing',
								formula: '1d4x+1d4x+1d4x+1d4x',
								parentContext: null,
								parentNode: null,
								canCrit: true,
								canMiss: true,
								on: {
									hit: [
										{
											id: 'a3P1uHz3p99oSEW8',
											type: 'damageOutcome',
											outcome: 'fullDamage',
											parentContext: 'hit',
											parentNode: 'SqqL7WHNreF474eJ',
										},
									],
								},
							},
						],
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-legendary-monsters.Actor.zaM78FA829bAaDmR',
		name: 'scorpion queen',
		items: [
			{
				name: 'vulnerable underbelly.',
				rules: [
					{
						type: 'attackOutcome',
						disabled: false,
						id: 'scorpionUnderbel',
						identifier: '',
						label: 'Vulnerable Underbelly',
						predicate: {},
						priority: 1,
						side: 'attacksAgainstYou',
						cannotMiss: false,
						critRange: 0,
						forceCrit: 'onHit',
						ignoreArmor: false,
						anyDieCrits: false,
						critD20: false,
						viciousCrits: false,
						attackDelivery: 'melee',
						thisItemOnly: false,
						attackSource: 'any',
						exceptItemIdentifier: '',
						otherCreature: {
							$and: ['target:prone'],
						},
						chargePoolIdentifier: '',
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-monsters.Actor.CnjRxzi5UaRzrObt',
		name: 'worg',
		items: [
			{
				name: 'savage.',
				rules: [
					{
						type: 'attackOutcome',
						disabled: false,
						id: 'worgSavageRule00',
						identifier: '',
						label: 'Savage',
						predicate: {},
						priority: 1,
						side: 'yourAttacks',
						cannotMiss: false,
						critRange: 0,
						forceCrit: 'always',
						ignoreArmor: false,
						anyDieCrits: false,
						critD20: false,
						viciousCrits: false,
						attackDelivery: 'any',
						thisItemOnly: false,
						attackSource: 'any',
						exceptItemIdentifier: '',
						otherCreature: {
							$and: ['target:grappled'],
						},
						chargePoolIdentifier: '',
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-monsters.Actor.Di9DjWDN5qAm65sa',
		name: 'kobold trapper',
		items: [
			{
				name: '[trap] - beees!',
				writes: [
					{
						path: 'activation.effects',
						from: [
							{
								id: 'ZFjq76ZLmapL0Gxm',
								type: 'damage',
								damageType: 'poison',
								formula: '5d4',
								parentContext: null,
								parentNode: null,
								on: {
									hit: [
										{
											id: 'Vy6Nc0MPvFDYXT9h',
											type: 'damageOutcome',
											outcome: 'fullDamage',
											parentContext: 'hit',
											parentNode: 'ZFjq76ZLmapL0Gxm',
										},
									],
								},
								canCrit: true,
								canMiss: true,
							},
						],
						to: [
							{
								id: 'ZFjq76ZLmapL0Gxm',
								type: 'damage',
								damageType: 'poison',
								formula: '5d4',
								parentContext: null,
								parentNode: null,
								on: {
									hit: [
										{
											id: 'Vy6Nc0MPvFDYXT9h',
											type: 'damageOutcome',
											outcome: 'fullDamage',
											parentContext: 'hit',
											parentNode: 'ZFjq76ZLmapL0Gxm',
										},
									],
								},
								canCrit: true,
								canMiss: false,
							},
						],
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-monsters.Actor.3qUezPmZUTHS4J0i',
		name: 'greater stirge',
		items: [
			{
				name: 'latched on.',
				rules: [
					{
						type: 'attackOutcome',
						disabled: false,
						id: 'latchedCannotMis',
						identifier: '',
						label: 'Latched On',
						predicate: {
							$and: ['self:latched'],
						},
						priority: 1,
						side: 'yourAttacks',
						cannotMiss: true,
						critRange: 0,
						forceCrit: 'none',
						ignoreArmor: false,
						anyDieCrits: false,
						critD20: false,
						viciousCrits: false,
						attackDelivery: 'any',
						thisItemOnly: false,
						attackSource: 'any',
						exceptItemIdentifier: '',
						otherCreature: {},
						chargePoolIdentifier: '',
					},
				],
			},
			{
				name: 'latch on.',
				rules: [
					{
						type: 'hitCondition',
						disabled: false,
						id: 'latchOnCondition',
						identifier: '',
						label: 'Latch On',
						predicate: {},
						priority: 1,
						condition: 'latched',
						when: 'hit',
						recipient: 'self',
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-monsters.Actor.4eLmzsN0UYJJBGkm',
		name: 'stirge',
		items: [
			{
				name: 'latch on.',
				rules: [
					{
						type: 'hitCondition',
						disabled: false,
						id: 'latchOnCondition',
						identifier: '',
						label: 'Latch On',
						predicate: {},
						priority: 1,
						condition: 'latched',
						when: 'hit',
						recipient: 'self',
					},
				],
			},
			{
				name: 'latched on.',
				rules: [
					{
						type: 'attackOutcome',
						disabled: false,
						id: 'latchedCannotMis',
						identifier: '',
						label: 'Latched On',
						predicate: {
							$and: ['self:latched'],
						},
						priority: 1,
						side: 'yourAttacks',
						cannotMiss: true,
						critRange: 0,
						forceCrit: 'none',
						ignoreArmor: false,
						anyDieCrits: false,
						critD20: false,
						viciousCrits: false,
						attackDelivery: 'any',
						thisItemOnly: false,
						attackSource: 'any',
						exceptItemIdentifier: '',
						otherCreature: {},
						chargePoolIdentifier: '',
					},
				],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-monsters.Actor.lQ83gZRlm3bTgsbp',
		name: 'great worm',
		items: [
			{
				name: 'bite/swallow.',
				rules: [
					{
						type: 'hitCondition',
						disabled: false,
						id: 'swallowCondition',
						identifier: '',
						label: 'Bite/Swallow',
						predicate: {},
						priority: 1,
						condition: 'swallowed',
						when: 'crit',
						recipient: 'target',
					},
				],
				writes: [
					{
						path: 'activation.effects',
						from: [
							{
								id: 'XOR7rxFVWDUzi9ra',
								type: 'damage',
								damageType: 'piercing',
								formula: '1d4+40',
								parentContext: null,
								parentNode: null,
								canCrit: true,
								canMiss: true,
								on: {
									hit: [
										{
											id: 'qevAAwWlfpuzGgpM',
											type: 'damageOutcome',
											outcome: 'fullDamage',
											parentContext: 'hit',
											parentNode: 'XOR7rxFVWDUzi9ra',
										},
									],
								},
							},
						],
						to: [
							{
								id: 'XOR7rxFVWDUzi9ra',
								type: 'damage',
								damageType: 'piercing',
								formula: '1d4+40',
								parentContext: null,
								parentNode: null,
								canCrit: true,
								canMiss: true,
								on: {
									hit: [
										{
											id: 'qevAAwWlfpuzGgpM',
											type: 'damageOutcome',
											outcome: 'fullDamage',
											parentContext: 'hit',
											parentNode: 'XOR7rxFVWDUzi9ra',
										},
									],
									criticalHit: [
										{
											id: 'swallowCritChip0',
											type: 'condition',
											condition: 'swallowed',
											parentContext: 'criticalHit',
											parentNode: 'XOR7rxFVWDUzi9ra',
										},
									],
								},
							},
						],
					},
				],
			},
		],
	},
];

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
 * Gives copies of the items of this work what the pack now ships: the Hunter's
 * attack abilities and the Thrill of the Hunt pool, Rampage, the Demand Control
 * features, and the monster rules.
 *
 * A pack rule is added unless a rule with its id is there. Nothing is added
 * beside a rule of the GM's own with a type the added rules use, so a feature
 * never works twice. A field is written only while it holds the old pack value,
 * and a rule changes only while it is as shipped.
 *
 * A feature is matched on compendium source id, falling back to the type, the
 * class and the name. A monster item is matched by its actor and its name,
 * because many monsters have an item of the same name. A second run changes
 * nothing.
 */
class Migration076StoredResults extends MigrationBase {
	static override readonly version = 76;

	override readonly version = Migration076StoredResults.version;

	override async updateItem(source: any, parent?: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		const spec =
			source.type === 'monsterFeature' ? this.#monsterItem(source, parent) : this.#match(source);
		if (!spec) return;

		if (spec.rules && system.rules == null) system.rules = [];
		const rules = Array.isArray(system.rules) ? system.rules : null;

		const rulesAdded = !!spec.rules && !!rules && this.#addRules(rules, spec);
		const ruleChanged = !!rules && this.#changeRule(rules, spec);
		const fieldsWritten = this.#writeFields(system, spec);

		if (!rulesAdded && !ruleChanged && !fieldsWritten) return;
		console.log(`Nimble Migration | ${source.name}: updated for stored results`);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) {
			return PACK_ITEMS.find((spec) => spec.sourceId === sourceId);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) =>
				spec.type === source.type &&
				spec.name === name &&
				spec.classIdentifier === source.system.class,
		);
	}

	#monsterItem(source: any, parent: any): ItemChanges | undefined {
		if (!parent) return undefined;
		const sourceId = toSnapshotId(this.getSourceId(parent));
		const actorName = String(parent.name ?? '')
			.trim()
			.toLowerCase();
		const monster = MONSTERS.find((spec) =>
			isCompendiumId(sourceId) ? spec.sourceId === sourceId : spec.name === actorName,
		);
		const name = String(source.name ?? '')
			.trim()
			.toLowerCase();
		return monster?.items.find((item) => item.name === name);
	}

	#addRules(rules: RuleSource[], spec: ItemChanges): boolean {
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

	#changeRule(rules: RuleSource[], spec: ItemChanges): boolean {
		if (!spec.ruleChange) return false;
		const { old, field, to } = spec.ruleChange;
		const rule = rules.find((candidate) => candidate?.id === old.id);
		if (!rule || !Object.entries(old).every(([key, value]) => deepEquals(rule[key], value))) {
			return false;
		}
		rule[field] = foundry.utils.deepClone(to);
		return true;
	}

	#writeFields(system: any, spec: ItemChanges): boolean {
		let changed = false;
		for (const { path, from, to } of spec.writes ?? []) {
			if (!deepEquals(stored(foundry.utils.getProperty(system, path)), stored(from))) continue;
			foundry.utils.setProperty(system, path, foundry.utils.deepClone(to));
			changed = true;
		}
		return changed;
	}
}

export { Migration076StoredResults };
