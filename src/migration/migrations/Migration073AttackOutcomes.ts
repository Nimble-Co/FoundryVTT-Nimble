import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface PackItemSpec {
	sourceId: string;
	type: 'feature' | 'object' | 'spell';
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	/** Empty for an item with no class: the type and the name match it. */
	classIdentifier: string;
	/** Set when the copy has none, so a rule can find the item by identifier. */
	identifier?: string;
	/** Set on the copy when it has no effects. */
	activation?: Record<string, unknown> & { effects: unknown[] };
	rules: RuleSource[];
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';
const MAGIC_ITEM_PREFIX = 'Compendium.nimble.nimble-magic-items.Item.';
const SPELL_PREFIX = 'Compendium.nimble.nimble-spells.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}CwDYqmsjbI6DVEOX`,
		type: 'feature',
		name: 'heads i win, tails you lose',
		classIdentifier: 'the-cheat',
		activation: {
			effects: [
				{
					id: 'kT3wQm8ZvB2nLx5R',
					type: 'healing',
					healingType: 'tempHealing',
					formula: '@level',
					parentContext: null,
					parentNode: null,
					recipient: 'self',
				},
			],
		},
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'YwEYD5uLtdIlEv9g',
				identifier: 'heads-i-win',
				label: 'Heads I Win, Tails You Lose (1/encounter)',
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
						trigger: 'encounterStart',
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
				id: 'pMdMmAUmT7L2PP54',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				poolIdentifier: 'heads-i-win',
				poolScope: 'item',
				cost: '1',
			},
			{
				type: 'toggleEffect',
				disabled: false,
				id: '2i7Yf6hCi1N9nB93',
				identifier: 'heads-i-win',
				label: 'Heads I Win, Tails You Lose',
				predicate: {},
				priority: 1,
				tags: ['self:heads-i-win'],
				turnOff: ['onRoundEnd', 'onEncounterEnd', 'onRest', 'onActorKilled'],
				confirmEndPrompt: '',
				clearPoolsOnEnd: [],
				endAfterInactiveRounds: null,
			},
			{
				type: 'attackOutcome',
				disabled: false,
				id: 'QXFhwkP6x084VaKU',
				identifier: '',
				label: 'Heads I Win, Tails You Lose',
				predicate: {
					self: 'heads-i-win',
				},
				priority: 2,
				side: 'yourAttacks',
				cannotMiss: true,
				critRange: 1,
				forceCrit: 'none',
				anyDieCrits: false,
				attackDelivery: 'any',
				thisItemOnly: false,
				otherCreature: {},
				chargePoolIdentifier: '',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}Vrg9rgHC5wCVSBB5`,
		type: 'feature',
		name: 'unleash the beast',
		classIdentifier: 'stormshifter',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'VTwxihHZ4HZOIq78',
				identifier: 'unleash-the-beast',
				label: 'Unleash the Beast (1/encounter)',
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
						trigger: 'encounterStart',
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
				type: 'makeCrit',
				disabled: false,
				id: '0DVaSFFND56WNfwt',
				identifier: '',
				label: 'Unleash the Beast',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				usedBy: 'roller',
				reach: 0,
				otherCreature: {},
				outcome: 'miss',
				attackDelivery: 'any',
				chargePoolIdentifier: 'unleash-the-beast',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}Tzb7WoEytYWSpDH9`,
		type: 'feature',
		name: "deathbringer's touch",
		classIdentifier: 'shepherd',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 's3SVWInS9sbuvsKC',
				identifier: 'deathbringers-touch',
				label: "Deathbringer's Touch (1/round)",
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
			},
			{
				type: 'attackOutcome',
				disabled: false,
				id: 'F9Kwl2GVpi4DGehy',
				exceptItemIdentifier: 'lifebinding-spirit',
				identifier: '',
				label: "Deathbringer's Touch",
				predicate: {},
				priority: 2,
				side: 'yourAttacks',
				cannotMiss: false,
				critRange: 0,
				forceCrit: 'always',
				anyDieCrits: false,
				attackDelivery: 'melee',
				thisItemOnly: false,
				otherCreature: {
					$and: ['target:bloodied'],
				},
				chargePoolIdentifier: 'deathbringers-touch',
			},
			{
				type: 'damageBonus',
				disabled: false,
				id: 'bP8wGf3SrZ6nVa1J',
				identifier: '',
				label: "Deathbringer's Touch: Lifebinding Spirit",
				predicate: {},
				priority: 3,
				value: '@strength',
				damageType: '',
				delivery: 'any',
				source: 'any',
				itemIdentifier: 'lifebinding-spirit',
				targetCondition: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}BO7a86IEU7Gf3iNr`,
		type: 'feature',
		name: 'bring the pain',
		classIdentifier: 'zephyr',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'CeQ4Kxcng0Bc4J0S',
				identifier: 'bring-the-pain',
				label: 'Bring the Pain (1/round)',
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
			},
			{
				type: 'makeCrit',
				disabled: false,
				id: 'fAvRAbLBKktaoyPE',
				identifier: '',
				label: 'Bring the Pain',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				usedBy: 'target',
				reach: 0,
				otherCreature: {},
				outcome: 'always',
				attackDelivery: 'melee',
				chargePoolIdentifier: 'bring-the-pain',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				cardHint: '',
				cardHintWhen: {},
			},
			{
				type: 'damageReduction',
				disabled: false,
				id: 'l5Qs4BESH8O0oEtv',
				identifier: '',
				label: 'Bring the Pain',
				predicate: {},
				priority: 3,
				mode: 'half',
				value: '0',
				damageTypes: [],
				onlyCrits: true,
			},
			{
				type: 'damageBack',
				disabled: false,
				id: 'xG4hNc7RqT2mWk9D',
				identifier: '',
				label: 'Bring the Pain',
				predicate: {},
				priority: 4,
				onlyCrits: true,
				woundDoubles: true,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}vahUZIJY59MJaKQP`,
		type: 'feature',
		name: 'slashing',
		classIdentifier: 'commander',
		rules: [
			{
				type: 'attackOutcome',
				disabled: false,
				id: 's7OVWCh9Vq1JPqkv',
				attackSource: 'weapon',
				identifier: '',
				label: 'Slashing',
				predicate: {
					$and: ['attack:damageType:slashing'],
				},
				priority: 1,
				side: 'yourAttacks',
				cannotMiss: true,
				critRange: 0,
				forceCrit: 'none',
				anyDieCrits: false,
				attackDelivery: 'any',
				thisItemOnly: false,
				otherCreature: {
					$and: ['target:armor:none'],
				},
				chargePoolIdentifier: '',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}n6Df3QpL8sV1xR2M`,
		type: 'feature',
		name: 'lifebinding spirit',
		classIdentifier: 'shepherd',
		identifier: 'lifebinding-spirit',
		activation: {
			cost: {
				details: '',
				quantity: 1,
				type: 'action',
				isReaction: false,
			},
			targets: {
				count: 1,
				restrictions: '',
				attackType: 'reach',
				distance: 4,
			},
			effects: [
				{
					id: 'qL7vXb2NtY9cKs4M',
					type: 'damage',
					damageType: 'radiant',
					formula: '1d6+@will',
					ignoreArmor: true,
					canCrit: true,
					canMiss: true,
					parentContext: null,
					parentNode: null,
					on: {
						hit: [
							{
								id: 'wR3zJp6HgD1fUe8A',
								type: 'damageOutcome',
								outcome: 'fullDamage',
								parentContext: 'hit',
								parentNode: 'qL7vXb2NtY9cKs4M',
							},
						],
					},
				},
				{
					id: 'mC5yTn9BvK2xQh7L',
					type: 'healing',
					healingType: 'healing',
					formula: '1d6+@will',
					targetDisposition: 'friendly',
					parentContext: null,
					parentNode: null,
				},
			],
		},
		rules: [],
	},
	{
		sourceId: `${MAGIC_ITEM_PREFIX}Bz018hWCZIoxRyzQ`,
		type: 'object',
		name: 'gnatbane weapon',
		classIdentifier: '',
		rules: [
			{
				type: 'attackOutcome',
				disabled: false,
				id: 'Nq7tR2vKxW9pLm3B',
				identifier: '',
				label: 'Gnatbane Weapon',
				predicate: {},
				priority: 1,
				side: 'yourAttacks',
				cannotMiss: true,
				critRange: 0,
				forceCrit: 'none',
				anyDieCrits: false,
				attackDelivery: 'any',
				thisItemOnly: true,
				otherCreature: {
					$or: ['target:size:small', 'target:size:tiny'],
				},
				chargePoolIdentifier: '',
			},
		],
	},
	{
		sourceId: `${SPELL_PREFIX}YgZwzCSYhDlz6KrF`,
		type: 'spell',
		name: 'shatter',
		classIdentifier: '',
		rules: [
			{
				type: 'attackOutcome',
				disabled: false,
				id: 'Hd4sYc8ZfG1uJb6E',
				identifier: '',
				label: 'Shatter',
				predicate: {},
				priority: 1,
				side: 'yourAttacks',
				cannotMiss: false,
				critRange: 0,
				forceCrit: 'none',
				anyDieCrits: true,
				attackDelivery: 'any',
				thisItemOnly: true,
				otherCreature: {
					$and: ['target:hampered'],
				},
				chargePoolIdentifier: '',
			},
		],
	},
];

function toPackSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	return snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)
		? `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`
		: snapshotId;
}

/**
 * Gives copies of the items whose attacks now have Attack Outcome, Make It a
 * Crit and Damage Back rules what the pack now ships: the rules, an identifier
 * the rules read, and activation effects when the copy has none. A pack rule
 * is added unless a rule with its id is there. Nothing is added beside a rule
 * of the GM's own with a type the pack item uses, so a feature never works
 * twice. Effects a GM gave a copy stay.
 *
 * Matched on compendium source id, falling back to the type, the class and the
 * name for a copy stripped of one. A second run changes nothing.
 */
class Migration073AttackOutcomes extends MigrationBase {
	static override readonly version = 73;

	override readonly version = Migration073AttackOutcomes.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		const spec = this.#match(source);
		if (!spec) return;

		const identifierSet = this.#setIdentifier(system, spec);
		const activationSet = this.#setActivation(system, spec);

		if (system.rules == null) system.rules = [];
		const rules = system.rules;
		const rulesAdded = spec.rules.length > 0 && Array.isArray(rules) && this.#addRules(rules, spec);

		if (!identifierSet && !activationSet && !rulesAdded) return;
		console.log(`Nimble Migration | ${source.name}: updated for Attack Outcomes`);
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

	#setIdentifier(system: any, spec: PackItemSpec): boolean {
		if (!spec.identifier || system.identifier) return false;
		system.identifier = spec.identifier;
		return true;
	}

	#setActivation(system: any, spec: PackItemSpec): boolean {
		if (!spec.activation) return false;
		const effects = system.activation?.effects;
		if (Array.isArray(effects) && effects.length > 0) return false;
		system.activation = { ...system.activation, ...foundry.utils.deepClone(spec.activation) };
		return true;
	}

	#addRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		const packIds = new Set(spec.rules.map((rule) => rule.id));
		const packTypes = new Set(spec.rules.map((rule) => rule.type));
		const hasOwn = rules.some((rule) => packTypes.has(rule?.type) && !packIds.has(rule.id));
		if (hasOwn) return false;

		let changed = false;
		for (const wanted of spec.rules) {
			if (rules.some((rule) => rule?.id === wanted.id)) continue;
			rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}
}

export { Migration073AttackOutcomes };
