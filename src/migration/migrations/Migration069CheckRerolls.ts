import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface PackItemSpec {
	sourceId: string;
	type: 'feature' | 'background';
	/** Lowercased, for a copy that lost its compendium id. */
	names: string[];
	classIdentifier?: string;
	/**
	 * Each added unless the item carries a rule with the same id. None is added
	 * beside a reroll rule of the GM's own, and when these bring a charge pool,
	 * none is added beside a charge rule of the GM's own.
	 */
	rules?: RuleSource[];
	/** Set on the rule with this id only while it still holds `from`. */
	rolls?: { id: string; from: string[]; to: string[] };
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';
const BACKGROUND_PREFIX = 'Compendium.nimble.nimble-backgrounds.Item.';

function chargePool(id: string, identifier: string, label: string): RuleSource {
	return {
		type: 'chargePool',
		disabled: false,
		id,
		identifier,
		label,
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
				trigger: 'safeRest',
				mode: 'refresh',
				value: '1',
			},
		],
	};
}

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
		rolls: ['skillCheck'],
		saves: [],
		skills: [],
		abilities: [],
		usedBy: 'roller',
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

const SO_DUMB_RULES: RuleSource[] = [
	chargePool(
		'LClY1NYmu2QbeXr6',
		'so-dumb-im-smart-sometimes-skill',
		"So Dumb I'm Smart Sometimes: INT skill check (1/Safe Rest)",
	),
	chargePool(
		'5nqfVynMtj8k8OS8',
		'so-dumb-im-smart-sometimes-save',
		"So Dumb I'm Smart Sometimes: INT save (1/Safe Rest)",
	),
	reroll({
		id: '1SYBiweRBQNjoARM',
		skills: ['arcana', 'examination', 'lore'],
		chargePoolIdentifier: 'so-dumb-im-smart-sometimes-skill',
	}),
	reroll({
		id: 'UA5HzpDBf66eZgmc',
		rolls: ['save'],
		saves: ['intelligence'],
		chargePoolIdentifier: 'so-dumb-im-smart-sometimes-save',
		rollModeChange: 1,
	}),
];

const BEGUILING_INFLUENCE_RULES: RuleSource[] = [
	chargePool('GDYnjVhtzNdh9YzW', 'beguiling-influence', 'Beguiling Influence (1/Safe Rest)'),
	reroll({
		id: 'vZMwyQ5cAsDOdB5E',
		skills: ['influence'],
		chargePoolIdentifier: 'beguiling-influence',
	}),
];

const BLOOD_SIGHT_RULES: RuleSource[] = [
	chargePool('xWhxCrLYXis3Ia61', 'blood-sight', 'Blood Sight (1/Safe Rest)'),
	reroll({
		id: '2DH0khjr6UI6KCMe',
		skills: ['examination'],
		chargePoolIdentifier: 'blood-sight',
	}),
];

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}1y4RJSu2xmimR26x`,
		type: 'feature',
		names: ['unstoppable brutality'],
		classIdentifier: 'berserker',
		rolls: { id: 'jpoDXUNkHIxxVzfD', from: ['attack'], to: ['attack', 'save'] },
	},
	{
		sourceId: `${BACKGROUND_PREFIX}BYLPmm5MwufOYWac`,
		type: 'background',
		names: ["so dumb i'm smart sometimes"],
		rules: SO_DUMB_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}btH7ygby2paN7iq1`,
		type: 'feature',
		names: ['beguiling influence'],
		classIdentifier: 'shadowmancer',
		rules: BEGUILING_INFLUENCE_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}4GAsAnTYpOC6EIUK`,
		type: 'feature',
		names: ['blood sight'],
		classIdentifier: 'shadowmancer',
		rules: BLOOD_SIGHT_RULES,
	},
];

function toPackSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	return snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)
		? `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`
		: snapshotId;
}

function sameList(value: unknown, wanted: string[]): boolean {
	return (
		Array.isArray(value) &&
		value.length === wanted.length &&
		value.every((entry, index) => entry === wanted[index])
	);
}

/**
 * Brings copies of four pack items to what the pack now ships for rerolls of
 * saves and skill checks: Unstoppable Brutality's reroll also takes saves, and
 * So Dumb I'm Smart Sometimes, Beguiling Influence and Blood Sight get their
 * reroll rules and pools. Matched on compendium source id, falling back to type,
 * class and name for a copy stripped of one. A pack rule is added unless a rule
 * with its id is there, and a `rolls` value the GM changed is kept. No pack rule
 * is added beside a reroll rule of the GM's own, and a pack pool and the rules
 * that read it stay out beside a charge rule of the GM's own. A second run
 * changes nothing.
 */
class Migration069CheckRerolls extends MigrationBase {
	static override readonly version = 69;

	override readonly version = Migration069CheckRerolls.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		const spec = this.#match(source);
		if (!spec) return;

		if (system.rules == null && spec.rules) system.rules = [];
		const rules = system.rules;
		if (!Array.isArray(rules)) return;

		const updated = [this.#addRules(rules, spec), this.#changeRolls(rules, spec)].some(Boolean);
		if (!updated) return;
		console.log(`Nimble Migration | ${source.name}: updated for check rerolls`);
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
		if (!spec.rules) return false;
		if (this.#hasOwnReroll(rules, spec.rules)) return false;
		if (this.#hasOwnChargeRules(rules, spec.rules)) return false;

		let changed = false;
		for (const wanted of spec.rules) {
			if (rules.some((rule) => rule?.id === wanted.id)) continue;
			rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	/** A reroll rule of the GM's own beside the pack's would give two buttons. */
	#hasOwnReroll(rules: RuleSource[], wanted: RuleSource[]): boolean {
		const packIds = new Set(wanted.map((rule) => rule.id));
		return rules.some((rule) => rule?.type === 'reroll' && !packIds.has(rule.id));
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

	#changeRolls(rules: RuleSource[], spec: PackItemSpec): boolean {
		if (!spec.rolls) return false;
		const { id, from, to } = spec.rolls;
		const target = rules.find((rule) => rule?.type === 'reroll' && rule.id === id);
		if (!target || !sameList(target.rolls, from)) return false;

		target.rolls = [...to];
		return true;
	}
}

export { Migration069CheckRerolls };
