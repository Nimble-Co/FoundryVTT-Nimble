import { isCompendiumId, SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

/** A rule swapped for `to` only while it still holds every value of `from`. */
interface RuleReplacement {
	from: RuleSource;
	to: RuleSource;
}

interface PackItemSpec {
	sourceId: string;
	type: 'feature';
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	classIdentifier: string;
	/** Rules the pack shipped before, so these do not count as the GM's own. */
	shippedRuleIds?: string[];
	rules?: RuleSource[];
	replacements?: RuleReplacement[];
}

const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}eE1rSZ1XBAON8YXM`,
		type: 'feature',
		name: 'peerless hunter',
		classIdentifier: 'hunter',
		replacements: [
			{
				from: {
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
				to: {
					type: 'defendOption',
					disabled: false,
					id: 'JBrZtb4I1Evl5ZDm',
					identifier: '',
					label: 'Peerless Hunter',
					predicate: {},
					priority: 1,
					way: 'freeDefend',
					attackDelivery: 'any',
					otherCreature: {
						$and: ['target:quarry'],
					},
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
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}Vr5Yj3QIHuVQ69p0`,
		type: 'feature',
		name: 'exploit',
		classIdentifier: 'oathsworn',
		replacements: [
			{
				from: {
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
				to: {
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
					reminder: 'Force an enemy within your aura to Interpose (not against its own attack).',
					useItem: false,
					withInterpose: false,
					wholeRound: false,
					range: '@auraReach',
					chargePoolIdentifier: '',
					chargeCost: 1,
					dicePoolIdentifier: 'judgment',
					actionCost: 1,
					manaCost: 0,
					woundCost: 0,
				},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}AwOBGBQ87459Nl2s`,
		type: 'feature',
		name: 'aura of zeal',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'auraReach',
				disabled: false,
				id: '3CfxwwUrCYPwlmLI',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				value: '4',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}Lo6AEKT7eppws7YI`,
		type: 'feature',
		name: 'aura of refuge',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'auraReach',
				disabled: false,
				id: 'oqaNrOFY2lNPOB4z',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				value: '4',
			},
		],
		replacements: [
			{
				from: {
					type: 'modifyIncomingAttack',
					disabled: false,
					id: 'ePC8z2QmXucSUUbm',
					identifier: '',
					label: '',
					predicate: {},
					priority: 1,
					modifier: 'redirectToSelf',
					range: 4,
				},
				to: {
					type: 'modifyIncomingAttack',
					disabled: false,
					id: 'ePC8z2QmXucSUUbm',
					identifier: '',
					label: '',
					predicate: {},
					priority: 1,
					modifier: 'redirectToSelf',
					range: '@auraReach',
				},
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}ij1nJObO15Whioif`,
		type: 'feature',
		name: 'aura of suffering',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'modifyIncomingAttack',
				disabled: false,
				id: '5ToEa90PPXiLOUqf',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				modifier: 'redirectToSelf',
				range: '@auraReach',
			},
			{
				type: 'auraReach',
				disabled: false,
				id: '7DpnygRtu3lTggOH',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				value: '4',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}cTUqJU9C5fhbgamU`,
		type: 'feature',
		name: 'improved aura',
		classIdentifier: 'oathsworn',
		rules: [
			{
				type: 'auraReach',
				disabled: false,
				id: '1Tqjn9nCIgw7xtTy',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				value: '2',
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}bIqEghM1BkChlRJD`,
		type: 'feature',
		name: 'burst of speed',
		classIdentifier: 'zephyr',
		replacements: [
			{
				from: {
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
				to: {
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
							trigger: 'encounterStart',
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
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}v4ihiCbIfuwNmx4v`,
		type: 'feature',
		name: 'windborne',
		classIdentifier: 'zephyr',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: '2jVESm2CSajGf7M0',
				identifier: '',
				label: 'Windborne: +1 Burst of Speed when you roll Initiative',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'burst-of-speed',
				dieSize: null,
				maxDelta: null,
				addRefills: [
					{
						trigger: 'encounterStart',
						mode: 'add',
						value: '1',
						predicate: {},
					},
				],
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}aTT5T3bYQNXCxT4O`,
		type: 'feature',
		name: 'kinetic momentum',
		classIdentifier: 'zephyr',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'cNj73kQlm7iN3vNv',
				identifier: '',
				label: 'Kinetic Momentum: gain a Burst of Speed for each Wound',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'burst-of-speed',
				dieSize: null,
				maxDelta: null,
				addRefills: [
					{
						trigger: 'onWound',
						mode: 'add',
						value: '1',
						predicate: {},
					},
				],
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

/**
 * Gives copies of the items of this work what the pack now ships: Peerless
 * Hunter tests the quarry, Exploit expends the Judgment Dice, the Oathsworn
 * auras read their range from the Aura Reach rule, Burst of Speed has no max,
 * and Windborne and Kinetic Momentum add Bursts of Speed.
 *
 * A pack rule is added unless a rule with its id is there. Nothing is added
 * beside a rule of the GM's own with a type the added rules use, so a feature
 * never works twice. A changed rule is replaced only while it still holds every
 * value it shipped with, so a rule the GM edited stays as it is.
 *
 * Matched on compendium source id (the document id, so an older pack name also
 * matches), falling back to the type, the class and the name for a copy
 * stripped of one. A second run changes nothing.
 */
class Migration078DefendFollowups extends MigrationBase {
	static override readonly version = 78;

	override readonly version = Migration078DefendFollowups.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		const spec = this.#match(source);
		if (!spec) return;

		if (spec.rules && system.rules == null) system.rules = [];
		const rules = Array.isArray(system.rules) ? system.rules : null;
		if (!rules) return;

		const rulesReplaced = this.#replaceRules(rules, spec);
		const rulesAdded = this.#addRules(rules, spec);

		if (!rulesReplaced && !rulesAdded) return;
		console.log(`Nimble Migration | ${source.name}: updated for Defend follow-ups`);
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
				spec.classIdentifier === source.system.class,
		);
	}

	#replaceRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		let changed = false;
		for (const { from, to } of spec.replacements ?? []) {
			const index = rules.findIndex((rule) => rule?.id === from.id);
			if (index === -1) continue;
			const rule = rules[index];
			if (!Object.entries(from).every(([key, value]) => deepEquals(rule[key], value))) continue;
			rules.splice(index, 1, foundry.utils.deepClone(to));
			changed = true;
		}
		return changed;
	}

	#addRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		const wantedRules = spec.rules ?? [];
		if (wantedRules.length === 0) return false;

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
}

export { Migration078DefendFollowups };
