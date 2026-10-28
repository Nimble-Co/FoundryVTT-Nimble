import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface PackItemSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	rules: RuleSource[];
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';
const POOL = 'songweavers-inspiration';
const OWN_RULE_TYPES = new Set(['modifyReroll', 'modifyPool']);

function modifyReroll(id: string, label: string, fields: Record<string, unknown>): RuleSource {
	return {
		type: 'modifyReroll',
		disabled: false,
		id,
		identifier: '',
		label,
		predicate: {},
		priority: 1,
		suppressActivationCard: 'auto',
		rerollIdentifier: POOL,
		rollModeChange: 0,
		extraDamage: '',
		actionsForRoller: 0,
		tempHp: '',
		tempHpWithin: 0,
		...fields,
	};
}

function modifyPool(id: string, label: string, fields: Record<string, unknown>): RuleSource {
	return {
		type: 'modifyPool',
		disabled: false,
		id,
		identifier: '',
		label,
		predicate: {},
		priority: 1,
		poolType: 'charge',
		poolIdentifier: POOL,
		dieSize: null,
		maxDelta: null,
		...fields,
	};
}

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}99gdSBTmxCWmKTgZ`,
		name: 'heroic ballad',
		rules: [
			modifyPool('WsahvMpr5UZttmr1', "Heroic Ballad: +2 max Songweaver's Inspiration charges", {
				maxDelta: '2',
			}),
			modifyReroll('3sarD7NY2XSbU6Ws', 'Heroic Ballad: +WIL damage on a rerolled attack', {
				priority: 2,
				extraDamage: '@will',
			}),
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}KkWqpX2MaeXJAj6W`,
		name: 'unfailing courage',
		rules: [
			modifyReroll('4YjGB75w2y11LUoO', 'Unfailing Courage: the reroll has advantage', {
				rollModeChange: 1,
			}),
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}x2yMiExkmLqN1Ge0`,
		name: 'fire in my bones',
		rules: [
			modifyReroll('6rJVNCnwFNiKH5D1', 'Fire in my Bones: +1 action for the one who rolled', {
				actionsForRoller: 1,
			}),
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}QYesl098hs8tr7oS`,
		name: 'inspiring presence',
		rules: [
			modifyReroll(
				'twYeLI5LqpF3fUsS',
				'Inspiring Presence: WIL temp HP to allies within 12 spaces',
				{
					tempHp: '@will',
					tempHpWithin: 12,
				},
			),
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}jBfbkX4fDvOKsoFD`,
		name: 'quick wit',
		rules: [
			{
				...modifyPool(
					'nskpz8ZTiVDUmFTE',
					"Quick Wit: regain 2 uses of Songweaver's Inspiration on Initiative",
					{},
				),
				addRefills: [
					{
						trigger: 'onInitiativeRolled',
						mode: 'add',
						value: '2',
						temporary: true,
						predicate: {},
					},
				],
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
 * Gives copies of Heroic Ballad, Unfailing Courage, Fire in my Bones, Inspiring
 * Presence and Quick Wit the rules the pack now ships, so they change
 * Songweaver's Inspiration and its charge pool. A pack rule is added unless a
 * rule with its id is there. Nothing is added beside a Modify Reroll or Modify
 * Pool rule of the GM's own, so a feature never changes the reroll twice.
 *
 * Matched on compendium source id, falling back to the Songweaver class and
 * the name for a copy stripped of one. A second run changes nothing.
 */
class Migration071ModifyReroll extends MigrationBase {
	static override readonly version = 71;

	override readonly version = Migration071ModifyReroll.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object' || source.type !== 'feature') return;

		const spec = this.#match(source);
		if (!spec) return;

		if (system.rules == null) system.rules = [];
		const rules = system.rules;
		if (!Array.isArray(rules)) return;

		if (!this.#addRules(rules, spec)) return;
		console.log(`Nimble Migration | ${source.name}: updated for Modify Reroll`);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return PACK_ITEMS.find((spec) => spec.sourceId === sourceId);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		if (source.system.class !== 'songweaver') return undefined;
		return PACK_ITEMS.find((spec) => spec.name === name);
	}

	#addRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		const packIds = new Set(spec.rules.map((rule) => rule.id));
		const hasOwn = rules.some(
			(rule) => OWN_RULE_TYPES.has(String(rule?.type)) && !packIds.has(rule.id),
		);
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

export { Migration071ModifyReroll };
