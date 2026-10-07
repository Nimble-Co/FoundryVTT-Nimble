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
	/**
	 * Each added unless the item carries a rule with the same id. When these
	 * bring a charge pool, none is added beside a charge rule of the GM's own.
	 */
	rules?: RuleSource[];
	/** Added only while the item carries no effect at all. */
	effects?: EffectSource[];
	/**
	 * A rule the pack no longer ships, replaced in place by the first of `rules`.
	 * A `formula` other than `oldFormula` becomes the successor's `distance`.
	 */
	replacesRule?: { id: string; type: string; oldFormula: string };
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
		message: '',
	},
];

const COORDINATED_STRIKE_RULES: RuleSource[] = [
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
		message: '',
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
		replacesRule: {
			id: 'swift-fury-gain-message',
			type: 'poolGainMessage',
			oldFormula: '@dexterity',
		},
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
 * Brings existing copies of the five class features the movement pilot
 * automated up to what the pack now ships: the Swift Fury and Coordinated
 * Strike! free moves, the Thunderous Steps and Chaos Lash movement triggers,
 * the Fleet Feet move node, and the Chaos Lash reaction with its push and save.
 *
 * Matched on compendium source id, falling back to class plus name for a copy
 * stripped of one. A pack rule is added unless a rule with its id is there, and
 * the Chaos Lash charge rules and trigger are added only while the copy has no
 * charge rule of the GM's own. Pack effects are added only to a copy with no
 * effects, so a GM's own card stays as built. The replaced Swift Fury rule keeps
 * its on/off state and a changed formula. The description and the cost change
 * only while they still hold the old pack value. A second run changes nothing.
 */
class Migration067MovementPilots extends MigrationBase {
	static override readonly version = 67;

	override readonly version = Migration067MovementPilots.version;

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
		if (hasSuccessor) {
			rules.splice(index, 1);
			return true;
		}

		const old = rules[index];
		const replacement: RuleSource = foundry.utils.deepClone(successor);
		if (typeof old.disabled === 'boolean') replacement.disabled = old.disabled;
		if (
			typeof old.formula === 'string' &&
			old.formula.trim() &&
			old.formula !== retired.oldFormula
		) {
			replacement.distance = old.formula;
		}
		rules.splice(index, 1, replacement);
		return true;
	}

	#addRules(source: any, spec: FeatureSpec): boolean {
		if (!spec.rules) return false;

		const system = source.system;
		if (system.rules == null) system.rules = [];
		if (!Array.isArray(system.rules)) return false;
		const rules: RuleSource[] = system.rules;
		if (this.#hasOwnChargeRules(rules, spec.rules)) return false;

		let changed = false;
		for (const wanted of spec.rules) {
			if (rules.some((rule) => rule?.id === wanted.id)) continue;
			rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	/**
	 * A charge pool or consumer the pack would not add. Beside a pack pool it
	 * would spend twice on one use, and without the pack pool the rules that
	 * read its tag could never fire, so the pack's rules stay out entirely.
	 */
	#hasOwnChargeRules(rules: RuleSource[], wanted: RuleSource[]): boolean {
		if (!wanted.some((rule) => rule.type === 'chargePool')) return false;

		const packIds = new Set(wanted.map((rule) => rule.id));
		return rules.some(
			(rule) =>
				(rule?.type === 'chargePool' || rule?.type === 'chargeConsumer') && !packIds.has(rule.id),
		);
	}

	#addEffects(source: any, spec: FeatureSpec): boolean {
		if (!spec.effects) return false;

		const activation = source.system.activation;
		if (!activation || typeof activation !== 'object') return false;
		if (activation.effects == null) activation.effects = [];
		if (!Array.isArray(activation.effects) || activation.effects.length > 0) return false;

		for (const node of spec.effects) activation.effects.push(foundry.utils.deepClone(node));
		return true;
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

export { Migration067MovementPilots };
