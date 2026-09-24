import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };
type EffectSource = Record<string, unknown> & { id?: unknown };

interface CostSource {
	details: string;
	quantity: number;
	type: string;
	isReaction: boolean;
}

interface FeatureSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	classIdentifier: string;
	/** Each added unless the item carries a rule with the same id. */
	rules?: RuleSource[];
	/** Each added unless the item carries an effect with the same id. */
	effects?: EffectSource[];
	/** A rule the pack no longer ships, replaced in place by the first of `rules`. */
	replacesRule?: { id: string; type: string };
	/** A fragment of the description, swapped only while the old one is present. */
	description?: { from: string; to: string };
	/** The whole cost, replaced only while every field is still the old value. */
	cost?: { from: CostSource; to: CostSource };
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';

const SWIFT_FURY_RULES: RuleSource[] = [
	{
		type: 'freeMove',
		disabled: false,
		id: 'swift-fury-free-move',
		identifier: '',
		label: 'Swift Fury',
		predicate: {},
		priority: 1,
		trigger: 'onPoolGain',
		poolIdentifier: 'fury',
		distance: '@dexterity',
		recipient: 'self',
		within: 12,
		direction: 'any',
		ignoresDifficultTerrain: true,
		chargePoolIdentifier: '',
	},
];

const THUNDEROUS_STEPS_RULES: RuleSource[] = [
	{
		type: 'movementTrigger',
		disabled: false,
		id: 'thunderous-steps-trigger',
		identifier: '',
		label: 'Thunderous Steps',
		predicate: {
			self: 'raging',
		},
		priority: 1,
		event: 'selfMoved',
		creature: 'any',
		kinds: ['regular', 'free'],
		minSpaces: 4,
		spacesScope: 'thisTurn',
		geometry: 'endsAdjacent',
		reach: 1,
		minTargets: 1,
		observerScope: 'self',
		allyRadius: 6,
		payload: 'use',
		message: '',
		chargePoolIdentifier: '',
	},
];

const HEAVY_STRIKE_EFFECTS: EffectSource[] = [
	{
		id: 'ZlYMdKeVkcuJ7Uux',
		type: 'move',
		kind: 'forced',
		recipient: 'targets',
		distance: '@strength',
		distanceBySize: {
			small: '@strength * 2',
			large: 'floor(@strength / 2)',
		},
		ignoreDifficultTerrain: true,
		direction: 'away',
		chooser: 'source',
		parentContext: null,
		parentNode: null,
	},
];

const ADVANCE_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'advance-round-pool',
		identifier: 'advance-round',
		label: 'Advance! (once per round)',
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
		type: 'movementTrigger',
		disabled: false,
		id: 'advance-trigger',
		identifier: '',
		label: 'Advance!',
		predicate: {},
		priority: 2,
		event: 'selfMoved',
		creature: 'enemy',
		kinds: ['regular', 'free'],
		minSpaces: 1,
		spacesScope: 'thisMovement',
		geometry: 'movedToward',
		reach: 1,
		minTargets: 1,
		observerScope: 'self',
		allyRadius: 6,
		payload: 'reminder',
		message: 'You moved toward {targets}. Gain advantage on your first melee attack against it.',
		chargePoolIdentifier: 'advance-round',
	},
];

const COORDINATED_STRIKE_RULES: RuleSource[] = [
	{
		type: 'freeMove',
		disabled: false,
		id: 'coordinated-strike-advance-free-move',
		identifier: '',
		label: 'Advance! (move before the strike)',
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
];

const FLEET_FEET_EFFECTS: EffectSource[] = [
	{
		id: 'Z2RgHVnXzsRTuIWI',
		type: 'move',
		kind: 'free',
		recipient: 'self',
		distance: '@speed',
		distanceBySize: {},
		ignoreDifficultTerrain: true,
		direction: 'any',
		chooser: 'mover',
		parentContext: null,
		parentNode: null,
	},
];

const SHARPSHOOTER_EFFECTS: EffectSource[] = [
	{
		id: 'shReminderN7kQ2x',
		type: 'note',
		noteType: 'reminder',
		text: 'Requires: you have not moved this turn, and your quarry is 4 or more spaces away. Then double the damage. Spaces moved this turn: {spacesMovedThisTurn}. Distance: {targetsSpacesAway}.',
		parentContext: null,
		parentNode: null,
	},
];

const CHAOS_LASH_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'chaos-lash-use-pool',
		identifier: 'chaos-lash-use',
		label: 'Chaos Lash use',
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
		id: 'chaos-lash-use-consumer',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'chaos-lash-use',
		poolScope: 'item',
		cost: '1',
	},
	{
		type: 'movementTrigger',
		disabled: false,
		id: 'chaos-lash-trigger',
		identifier: '',
		label: 'Chaos Lash',
		predicate: {
			'self:chaos-lash-useChargePool': {
				min: 1,
			},
		},
		priority: 3,
		event: 'creatureMoved',
		creature: 'enemy',
		kinds: ['regular', 'free', 'forced'],
		minSpaces: 0,
		spacesScope: 'thisTurn',
		geometry: 'enteredReach',
		reach: 1,
		minTargets: 1,
		observerScope: 'self',
		allyRadius: 6,
		payload: 'use',
		message: '',
		chargePoolIdentifier: '',
	},
];

const CHAOS_LASH_EFFECTS: EffectSource[] = [
	{
		id: 'gmO2MKqpZnQXXYfP',
		type: 'move',
		kind: 'forced',
		recipient: 'targets',
		distance: '2',
		distanceBySize: {},
		ignoreDifficultTerrain: true,
		direction: 'away',
		chooser: 'source',
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'aT3fhQwScelVWqMl',
		type: 'savingThrow',
		savingThrowType: 'will',
		parentContext: null,
		parentNode: null,
		saveType: 'will',
		on: {
			failedSave: [
				{
					id: 'ygKnUFB52UVUP3K3',
					type: 'condition',
					condition: 'prone',
					parentContext: 'failedSave',
					parentNode: 'aT3fhQwScelVWqMl',
				},
			],
		},
		sharedRolls: [],
	},
];

const CHAOS_LASH_OLD_COST: CostSource = {
	details: '',
	quantity: 1,
	type: 'none',
	isReaction: false,
};

const CHAOS_LASH_COST: CostSource = {
	details: 'when an enemy moves adjacent to you',
	quantity: 1,
	type: 'action',
	isReaction: true,
};

const FEATURES: FeatureSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}0mqEGhkAP8NlDPzg`,
		name: 'swift fury',
		classIdentifier: 'berserker',
		rules: SWIFT_FURY_RULES,
		replacesRule: { id: 'swift-fury-gain-message', type: 'poolGainMessage' },
		description: {
			from: '<p><em>A chat reminder with your movement distance posts whenever you gain Fury Dice.</em></p>',
			to: '<p><em>A Movement Offer card posts whenever you gain Fury Dice.</em></p>',
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}Ecmnf0pXwd511FKP`,
		name: 'thunderous steps',
		classIdentifier: 'berserker',
		rules: THUNDEROUS_STEPS_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}FrPigc4J5msonEaJ`,
		name: 'heavy strike',
		classIdentifier: 'commander',
		effects: HEAVY_STRIKE_EFFECTS,
	},
	{
		sourceId: `${FEATURE_PREFIX}fht1hR5rcOu25b9a`,
		name: 'advance!',
		classIdentifier: 'commander',
		rules: ADVANCE_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}6xpILHYt5KTSnTtd`,
		name: 'coordinated strike!',
		classIdentifier: 'commander',
		rules: COORDINATED_STRIKE_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}uj7u8scrrKO3fqyD`,
		name: 'fleet feet',
		classIdentifier: 'hunter',
		effects: FLEET_FEET_EFFECTS,
	},
	{
		sourceId: `${FEATURE_PREFIX}nNRo9ohAHsyQfs7r`,
		name: 'sharpshooter',
		classIdentifier: 'hunter',
		effects: SHARPSHOOTER_EFFECTS,
	},
	{
		sourceId: `${FEATURE_PREFIX}g7lFxdEnjQtedrkN`,
		name: 'chaos lash',
		classIdentifier: 'mage',
		rules: CHAOS_LASH_RULES,
		effects: CHAOS_LASH_EFFECTS,
		cost: { from: CHAOS_LASH_OLD_COST, to: CHAOS_LASH_COST },
	},
];

function toFeatureSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	return snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)
		? `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`
		: snapshotId;
}

/** A copy made before a field existed reads as the default the schema fills in. */
function sameCost(stored: any, wanted: CostSource): boolean {
	return (
		(stored?.details ?? '') === wanted.details &&
		(stored?.quantity ?? 1) === wanted.quantity &&
		stored?.type === wanted.type &&
		(stored?.isReaction ?? false) === wanted.isReaction
	);
}

/**
 * Brings existing copies of the eight class features the movement pilot
 * automated up to what the pack now ships: the free moves, the movement
 * triggers and the move nodes, the Chaos Lash reaction with its save, and the
 * Sharpshooter reminder.
 *
 * Matched on compendium source id, falling back to class plus name for a copy
 * stripped of one. Rules and effects are keyed by id, so a GM's own rule or
 * effect stays where it is and a second run changes nothing. The description
 * and the cost change only while they still hold the old pack value.
 */
class Migration062MovementPilots extends MigrationBase {
	static override readonly version = 62;

	override readonly version = Migration062MovementPilots.version;

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature' || !source.system) return;

		const spec = this.#match(source);
		if (!spec) return;

		const changed = [
			this.#replaceRule(source, spec),
			this.#addRules(source, spec),
			this.#addEffects(source, spec),
			this.#setDescription(source, spec),
			this.#setCost(source, spec),
		].some(Boolean);
		if (!changed) return;

		console.log(`Nimble Migration | ${source.name ?? spec.name}: updated for the movement pilot`);
	}

	#match(source: any): FeatureSpec | undefined {
		const sourceId = toFeatureSourceId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return FEATURES.find((spec) => spec.sourceId === sourceId);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return FEATURES.find(
			(spec) => spec.name === name && source.system.class === spec.classIdentifier,
		);
	}

	/** Swaps the retired rule for its successor at the same place in the list. */
	#replaceRule(source: any, spec: FeatureSpec): boolean {
		const retired = spec.replacesRule;
		const successor = spec.rules?.[0];
		const rules = source.system.rules;
		if (!retired || !successor || !Array.isArray(rules)) return false;

		const index = rules.findIndex(
			(rule: RuleSource) => rule?.id === retired.id && rule?.type === retired.type,
		);
		if (index === -1) return false;

		const hasSuccessor = rules.some((rule: RuleSource) => rule?.id === successor.id);
		if (hasSuccessor) rules.splice(index, 1);
		else rules.splice(index, 1, foundry.utils.deepClone(successor));
		return true;
	}

	#addRules(source: any, spec: FeatureSpec): boolean {
		if (!spec.rules) return false;

		const system = source.system;
		if (system.rules == null) system.rules = [];
		if (!Array.isArray(system.rules)) return false;
		const rules: RuleSource[] = system.rules;

		let changed = false;
		for (const wanted of spec.rules) {
			if (rules.some((rule) => rule?.id === wanted.id)) continue;
			rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	#addEffects(source: any, spec: FeatureSpec): boolean {
		if (!spec.effects) return false;

		const activation = source.system.activation;
		if (!activation || typeof activation !== 'object') return false;
		if (activation.effects == null) activation.effects = [];
		if (!Array.isArray(activation.effects)) return false;
		const effects: EffectSource[] = activation.effects;

		let changed = false;
		for (const wanted of spec.effects) {
			if (effects.some((node) => node?.id === wanted.id)) continue;
			effects.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	#setDescription(source: any, spec: FeatureSpec): boolean {
		const description = source.system.description;
		if (!spec.description || typeof description !== 'string') return false;
		if (!description.includes(spec.description.from)) return false;

		source.system.description = description.replace(spec.description.from, spec.description.to);
		return true;
	}

	#setCost(source: any, spec: FeatureSpec): boolean {
		const activation = source.system.activation;
		if (!spec.cost || !activation || typeof activation !== 'object') return false;
		if (!sameCost(activation.cost, spec.cost.from)) return false;

		activation.cost = { ...activation.cost, ...spec.cost.to };
		return true;
	}
}

export { Migration062MovementPilots };
