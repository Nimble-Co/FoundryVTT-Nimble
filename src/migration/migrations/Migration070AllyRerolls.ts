import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface PackItemSpec {
	sourceId: string;
	type: 'feature' | 'ancestryBonus';
	/** Lowercased, for a copy that lost its compendium id. */
	names: string[];
	classIdentifier?: string;
	/**
	 * Each added unless the item carries a rule with the same id. None is added
	 * beside a reroll rule of the GM's own, nor beside a charge rule of the GM's
	 * own.
	 */
	rules: RuleSource[];
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';
const ANCESTRY_BONUS_PREFIX = 'Compendium.nimble.nimble-ancestry-bonuses.Item.';

function reroll(fields: Record<string, unknown>): RuleSource {
	return {
		type: 'reroll',
		disabled: false,
		id: '',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		suppressActivationCard: 'auto',
		rolls: ['attack', 'save'],
		saves: [],
		skills: [],
		abilities: [],
		usedBy: 'ally',
		reach: 0,
		die: 'pickedDie',
		keep: 'new',
		outcome: 'always',
		attackDelivery: 'any',
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		rollModeChange: 0,
		primaryDieBonus: 0,
		extraDamage: '',
		automatic: false,
		discardedCritTriggers: false,
		oncePerAttack: false,
		...fields,
	};
}

const SONGWEAVERS_INSPIRATION_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: '6sqyzYbuyfK8ZMFY',
		identifier: 'songweavers-inspiration',
		label: "Songweaver's Inspiration (2×WIL/Safe Rest)",
		predicate: {},
		priority: 1,
		scope: 'item',
		max: 'max(2 * @will, 0)',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: true,
		recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
	},
	reroll({
		id: 'pcJYnQqF2qxgjKiU',
		identifier: 'songweavers-inspiration',
		keep: 'rollerChooses',
		chargePoolIdentifier: 'songweavers-inspiration',
	}),
];

const OPTIMISTIC_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'hmFVxSMoWCRN2Ezz',
		identifier: 'optimistic',
		label: 'Optimistic (1/healed to max HP)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [
			{ trigger: 'onHealed', mode: 'refresh', value: '1', predicate: { self: 'fullHp' } },
			{ trigger: 'safeRest', mode: 'refresh', value: '1' },
		],
	},
	reroll({
		id: 'UzmmzgQsrj71E4dx',
		priority: 3,
		rolls: ['attack', 'save', 'skillCheck', 'abilityCheck'],
		reach: 6,
		chargePoolIdentifier: 'optimistic',
	}),
];

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}1FeFOFKQevbpIHhu`,
		type: 'feature',
		names: ["songweaver's inspiration"],
		classIdentifier: 'songweaver',
		rules: SONGWEAVERS_INSPIRATION_RULES,
	},
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}bK2KkZ5MbXeKoriS`,
		type: 'ancestryBonus',
		names: ['optimistic'],
		rules: OPTIMISTIC_RULES,
	},
];

/**
 * A pack attack whose damage node had no hit result, so a hit card showed no
 * damage or reroll buttons. `childIds` are the pack's hit, miss and crit
 * children; null when only the formula changes.
 */
interface DamageNodeSpec {
	/** The pack in the source id, with or without its `nimble-` prefix. */
	pack: 'magic-items' | 'spells' | 'class-features';
	itemId: string;
	type: 'object' | 'spell' | 'feature';
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	classIdentifier?: string;
	nodeId: string;
	childIds: { miss: string; criticalHit: string; hit: string } | null;
	formula?: { from: string; to: string };
}

const DAMAGE_NODE_ITEMS: DamageNodeSpec[] = [
	{
		pack: 'magic-items',
		itemId: '3UrdnS0by2muqXoH',
		type: 'object',
		name: "grimbeard's warhammer",
		nodeId: 'GrimbeardDmg',
		childIds: {
			miss: '9icIp9vs60wyzeFM',
			criticalHit: 'aYtrx15vPvREQE2l',
			hit: 'BWmlLyTrP63efuNQ',
		},
		formula: { from: '1d10+@str', to: '1d10+@strength' },
	},
	{
		pack: 'magic-items',
		itemId: 'NIAAt3nrRmsuvrZL',
		type: 'object',
		name: 'fiendish runeblade',
		nodeId: 'FiendishRuneDmg',
		childIds: {
			miss: 'ZFRjbqg9SYvtbGpH',
			criticalHit: 'r4wjM03ZetSTjW1V',
			hit: 'XQETP377B9AXXUDX',
		},
	},
	{
		pack: 'magic-items',
		itemId: '9g6AyWhjO3vrD2i4',
		type: 'object',
		name: 'venomfang dagger',
		nodeId: 'VenomfangDmg',
		childIds: {
			miss: 'yqd1YxWUPrzDSX0i',
			criticalHit: 'VRZ2BczqgFA1Eylv',
			hit: 'WfgPkyuO9FO2of7O',
		},
	},
	{
		pack: 'magic-items',
		itemId: 'wav5q8mcXBFyNvD6',
		type: 'object',
		name: 'manglemaul',
		nodeId: 'ManglemaulDmg',
		childIds: null,
		formula: { from: '1d6+@str', to: '1d6+@strength' },
	},
	{
		pack: 'spells',
		itemId: 'aoCnJhoJji5s5Etf',
		type: 'spell',
		name: 'shadow trap',
		nodeId: 'tMyTaEsCtivi63VN',
		childIds: {
			miss: 'bloHVeUhmDpC6rn5',
			criticalHit: 'Q7AS1WhDyGlakzrl',
			hit: 'uviGQOlMHcakXbU3',
		},
	},
	{
		pack: 'class-features',
		itemId: 'KQiBYDr1BBTE0iJq',
		type: 'feature',
		name: 'searing light',
		classIdentifier: 'shepherd',
		nodeId: 'SearingLightDamage1',
		childIds: {
			miss: '7Pt9HZkaBHeDOUzJ',
			criticalHit: 'hoGS4h5cDShX8sjc',
			hit: 'a0IY6dMDHYjTfyfT',
		},
	},
];

const PACK_SOURCE_ID = /^Compendium\.nimble\.(?:nimble-)?([a-z-]+)\.Item\.([A-Za-z0-9]+)$/;

function attackChildren(nodeId: string, ids: NonNullable<DamageNodeSpec['childIds']>) {
	const note = (id: string, parentContext: string, text: string) => ({
		id,
		type: 'note',
		noteType: 'warning',
		text,
		parentContext,
		parentNode: nodeId,
	});
	return {
		miss: [note(ids.miss, 'miss', 'MISS')],
		criticalHit: [note(ids.criticalHit, 'criticalHit', 'CRIT')],
		hit: [
			{
				id: ids.hit,
				type: 'damageOutcome',
				outcome: 'fullDamage',
				parentContext: 'hit',
				parentNode: nodeId,
			},
		],
	};
}

function toPackSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	return snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)
		? `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`
		: snapshotId;
}

/**
 * Gives copies of Songweaver's Inspiration and Optimistic the pool and the ally
 * reroll the pack now ships. A pack rule is added unless a rule with its id is
 * there. Nothing is added beside a reroll, charge pool or charge consumer rule
 * of the GM's own.
 *
 * Also gives five pack attacks the hit, miss and crit results of their damage
 * node, so a hit shows its damage and reroll buttons, and fixes the `@str`
 * formula of two magic weapons. Only a node with the pack's id and no hit
 * result gets the children, and only a formula still as the pack shipped it
 * changes.
 *
 * Matched on compendium source id, falling back to type, class and name for a
 * copy stripped of one. A second run changes nothing.
 */
class Migration070AllyRerolls extends MigrationBase {
	static override readonly version = 70;

	override readonly version = Migration070AllyRerolls.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		if (this.#updateDamageNode(source)) {
			console.log(`Nimble Migration | ${source.name}: damage node updated`);
		}

		const spec = this.#match(source);
		if (!spec) return;

		if (system.rules == null) system.rules = [];
		const rules = system.rules;
		if (!Array.isArray(rules)) return;

		if (!this.#addRules(rules, spec)) return;
		console.log(`Nimble Migration | ${source.name}: updated for ally rerolls`);
	}

	#updateDamageNode(source: any): boolean {
		const spec = this.#matchDamageNodeItem(source);
		const effects = source.system.activation?.effects;
		if (!spec || !Array.isArray(effects)) return false;

		const node = effects.find(
			(effect: any) => effect?.id === spec.nodeId && effect.type === 'damage',
		);
		if (!node) return false;

		let changed = false;
		if (spec.formula && node.formula === spec.formula.from) {
			node.formula = spec.formula.to;
			changed = true;
		}

		const hasHit = Array.isArray(node.on?.hit) && node.on.hit.length > 0;
		if (spec.childIds && !hasHit) {
			const on = node.on && typeof node.on === 'object' ? node.on : {};
			for (const [context, children] of Object.entries(
				attackChildren(spec.nodeId, spec.childIds),
			)) {
				if (!Array.isArray(on[context]) || on[context].length === 0) on[context] = children;
			}
			node.on = on;
			node.canCrit = true;
			node.canMiss = true;
			changed = true;
		}
		return changed;
	}

	#matchDamageNodeItem(source: any): DamageNodeSpec | undefined {
		const sourceId = toSnapshotId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			const match = PACK_SOURCE_ID.exec(sourceId);
			return DAMAGE_NODE_ITEMS.find(
				(spec) => spec.pack === match?.[1] && spec.itemId === match[2] && spec.type === source.type,
			);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return DAMAGE_NODE_ITEMS.find(
			(spec) =>
				spec.type === source.type &&
				spec.name === name &&
				(spec.classIdentifier === undefined || source.system.class === spec.classIdentifier),
		);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return PACK_ITEMS.find((spec) => spec.sourceId === sourceId && spec.type === source.type);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) =>
				spec.type === source.type &&
				spec.names.includes(name) &&
				(spec.classIdentifier === undefined || source.system.class === spec.classIdentifier),
		);
	}

	#addRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		if (this.#hasOwnRules(rules, spec.rules)) return false;

		let changed = false;
		for (const wanted of spec.rules) {
			if (rules.some((rule) => rule?.id === wanted.id)) continue;
			rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	/**
	 * A reroll or charge rule the pack would not add. A second reroll gives two
	 * buttons, and a second pool or a consumer spends twice on one use.
	 */
	#hasOwnRules(rules: RuleSource[], wanted: RuleSource[]): boolean {
		const packIds = new Set(wanted.map((rule) => rule.id));
		return rules.some(
			(rule) =>
				(rule?.type === 'reroll' ||
					rule?.type === 'chargePool' ||
					rule?.type === 'chargeConsumer') &&
				!packIds.has(rule.id),
		);
	}
}

export { Migration070AllyRerolls };
