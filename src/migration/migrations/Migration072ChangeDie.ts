import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface PackItemSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	classIdentifier: string;
	/** Set when the copy has none, so a tag does not depend on the name. */
	identifier?: string;
	rules: RuleSource[];
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}SAsHW8p9yrwDrxUg`,
		name: 'supreme execution',
		classIdentifier: 'the-cheat',
		identifier: 'supreme-execution',
		rules: [],
	},
	{
		sourceId: `${FEATURE_PREFIX}kHjJhTZEQcdbUMbb`,
		name: 'vicious opportunist',
		classIdentifier: 'the-cheat',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'rx3oOrQaWNVWae4a',
				identifier: 'vicious-opportunist',
				label: 'Vicious Opportunist (1/turn)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{ trigger: 'onTurnStart', mode: 'refresh', value: '1' },
					{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
				],
			},
			{
				type: 'changeDie',
				disabled: false,
				id: 'fSZR3ZQdBfmyLG3n',
				identifier: '',
				label: 'Vicious Opportunist',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				die: 'primaryDie',
				change: 'set',
				amount: 1,
				otherCreature: {
					$or: ['target:distracted', 'target:exploit-weakness', 'feature:supreme-execution'],
				},
				outcome: 'hit',
				attackDelivery: 'melee',
				chargePoolIdentifier: 'vicious-opportunist',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				oncePerAttack: false,
				cardHint: 'If the target is not Distracted, attack with a blade (Supreme Execution)',
				cardHintWhen: { $and: ['feature:supreme-execution'] },
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}u6OodblCAOnSXr7g`,
		name: "that's not what happened!",
		classIdentifier: 'the-cheat',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'kDkMrmZLXxa3TTuJ',
				identifier: 'thats-not-what-happened',
				label: "THAT'S Not What Happened! (1/Safe Rest)",
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
			},
			{
				type: 'changeDie',
				disabled: false,
				id: 'PDi96dVPqpzRW3ty',
				identifier: '',
				label: "THAT'S Not What Happened!",
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'target',
				reach: 0,
				die: 'primaryDie',
				change: 'set',
				amount: 1,
				otherCreature: { $and: ['target:distracted'] },
				outcome: 'hit',
				attackDelivery: 'any',
				chargePoolIdentifier: 'thats-not-what-happened',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 1,
				oncePerAttack: false,
				cardHint: '',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}BKQ0hIqBvjSpS1xR`,
		name: 'feinting attack',
		classIdentifier: 'the-cheat',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'ss6MY4JTCKmO4MjC',
				identifier: 'feinting-attack',
				label: 'Feinting Attack (1/round)',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: '1',
				dieSize: null,
				initial: 'max',
				hidden: false,
				showAsResource: false,
				recoveries: [
					{ trigger: 'onTurnStart', mode: 'refresh', value: '1' },
					{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
				],
			},
			{
				type: 'changeDie',
				disabled: false,
				id: 'hD0YqPJG3dHETk9y',
				identifier: '',
				label: 'Feinting Attack',
				predicate: {},
				priority: 2,
				suppressActivationCard: 'auto',
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				usedBy: 'roller',
				reach: 0,
				die: 'primaryDie',
				change: 'set',
				amount: 1,
				otherCreature: {},
				outcome: 'miss',
				attackDelivery: 'any',
				chargePoolIdentifier: 'feinting-attack',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
				actionCost: 0,
				oncePerAttack: false,
				cardHint: 'Your 2nd miss this round',
				cardHintWhen: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}YgZVZ99adWTRlCvb`,
		name: 'unerring judgment',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'primaryDieBonus',
				disabled: false,
				id: 'c9Vx64ablxbBlJzU',
				identifier: '',
				label: 'Unerring Judgment',
				predicate: { $and: ['self:pool:judgment'] },
				priority: 1,
				value: '1',
				attackDelivery: 'melee',
				otherCreature: {},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}TvMw7atoFebWo5WN`,
		name: 'exploit weakness',
		classIdentifier: 'the-cheat',
		rules: [
			{
				type: 'markTarget',
				disabled: false,
				id: '5Xb6IGjRFlB8K4SB',
				identifier: '',
				label: 'Exploit Weakness',
				predicate: {},
				priority: 1,
				flagKey: 'exploit-weakness',
				statusCondition: 'marked',
				maxTargets: 1,
				endsAtEncounterEnd: true,
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
 * Gives copies of Vicious Opportunist, THAT'S Not What Happened!, Feinting
 * Attack, Unerring Judgment and Exploit Weakness the rules the pack now ships,
 * and a copy of Supreme Execution with no identifier the pack's identifier.
 * A pack rule is added unless a rule with its id is there. Nothing is added
 * beside a rule of the GM's own with a type the pack item uses, so a feature
 * never works twice.
 *
 * Matched on compendium source id, falling back to the class and the name for
 * a copy stripped of one. A second run changes nothing.
 */
class Migration072ChangeDie extends MigrationBase {
	static override readonly version = 72;

	override readonly version = Migration072ChangeDie.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object' || source.type !== 'feature') return;

		const spec = this.#match(source);
		if (!spec) return;

		const identifierSet = this.#setIdentifier(system, spec);

		if (system.rules == null) system.rules = [];
		const rules = system.rules;
		const rulesAdded = Array.isArray(rules) && this.#addRules(rules, spec);

		if (!identifierSet && !rulesAdded) return;
		console.log(`Nimble Migration | ${source.name}: updated for Change a Die`);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return PACK_ITEMS.find((spec) => spec.sourceId === sourceId);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) => spec.name === name && spec.classIdentifier === source.system.class,
		);
	}

	#setIdentifier(system: any, spec: PackItemSpec): boolean {
		if (!spec.identifier || system.identifier) return false;
		system.identifier = spec.identifier;
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

export { Migration072ChangeDie };
