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
	 * beside a reroll rule of the GM's own, and when these bring a charge pool,
	 * none is added beside a charge rule of the GM's own.
	 */
	rules?: RuleSource[];
	/** `rules` are added only while the item carries a rule with this id. */
	rulesNeedRuleId?: string;
	/**
	 * Set on the rule with this id when this run converted it. A
	 * `chargePoolIdentifier` is set only while the item has a pool with that tag.
	 */
	converted?: { id: string; changes: Record<string, unknown> };
	/** Replaced only while the name is still the old one. */
	name?: { from: string; to: string };
}

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';
const ANCESTRY_BONUS_PREFIX = 'Compendium.nimble.nimble-ancestry-bonuses.Item.';

/** Keys only the removed forced reroll mode had. */
const REMOVED_KEYS = ['automatic', 'rerollTrigger', 'rerollWithDisadvantage'];
/** Keys of a modifyIncomingAttack rule that a reroll rule does not have. */
const INCOMING_ATTACK_KEYS = ['modifier', 'range', 'missThreshold', ...REMOVED_KEYS];
/** A converted rule takes these only from the old rule. */
const BASE_KEYS = ['disabled', 'id', 'identifier', 'label', 'predicate', 'priority'];
const OLD_TRIGGERS = new Set(['always', 'hit', 'criticalHit']);

function chargePool(id: string, identifier: string, label: string, uses: string): RuleSource {
	return {
		type: 'chargePool',
		disabled: false,
		id,
		identifier,
		label,
		predicate: {},
		priority: 1,
		scope: 'item',
		max: uses,
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [
			{
				trigger: 'encounterEnd',
				mode: 'refresh',
				value: uses,
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
		priority: 1,
		suppressActivationCard: 'auto',
		rolls: ['attack'],
		usedBy: 'target',
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

const POCKET_SAND_POOL = chargePool(
	'MVE6XSpb5pjS6tzS',
	'pocket-sand',
	'Pocket Sand (2/encounter)',
	'2',
);

const STRENGTH_OF_STONE_RULES: RuleSource[] = [
	chargePool('mlOTQQZYk27NHFCE', 'strength-of-stone', 'Strength of Stone (1/encounter)', '1'),
	reroll({
		id: 'IYPgkLaFdJxohpkT',
		label: 'Strength of Stone',
		priority: 2,
		outcome: 'criticalHit',
		chargePoolIdentifier: 'strength-of-stone',
	}),
];

const WILY_RULES: RuleSource[] = [
	chargePool('67DMZ5mCJGQwlYvy', 'wily', 'Wily (1/encounter)', '1'),
	reroll({
		id: '7cex6ECfNqnD2Ln5',
		priority: 2,
		outcome: 'nonCriticalHit',
		chargePoolIdentifier: 'wily',
	}),
];

const UNSTOPPABLE_BRUTALITY_RULES: RuleSource[] = [
	reroll({
		id: 'jpoDXUNkHIxxVzfD',
		predicate: { self: 'raging' },
		usedBy: 'roller',
		woundCost: 1,
	}),
];

const INERRANT_STRIKE_RULES: RuleSource[] = [
	reroll({
		id: 'SR4BSATJmlsbW6tI',
		usedBy: 'roller',
		outcome: 'miss',
		chargePoolIdentifier: 'combat-dice',
		primaryDieBonus: 1,
		extraDamage: '1d@pools.combat-dice.faces',
		oncePerAttack: true,
	}),
];

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}CLAQBXSaK5TgFsmN`,
		type: 'feature',
		names: ["mountain's endurance"],
		classIdentifier: 'berserker',
		converted: { id: '2t2MTnfR7EJBX5LP', changes: { discardedCritTriggers: true } },
	},
	{
		sourceId: `${FEATURE_PREFIX}MM8MxrvZ7jnoGOa8`,
		type: 'feature',
		names: ['pocket sand'],
		classIdentifier: 'the-cheat',
		rules: [POCKET_SAND_POOL],
		rulesNeedRuleId: 'CqGMYxQoLrVI17x3',
		converted: {
			id: 'CqGMYxQoLrVI17x3',
			changes: {
				priority: 2,
				attackDelivery: 'melee',
				chargePoolIdentifier: 'pocket-sand',
				oncePerAttack: true,
			},
		},
	},
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}BNt1EadnOGvzAHsC`,
		type: 'ancestryBonus',
		names: ['strength of stone'],
		rules: STRENGTH_OF_STONE_RULES,
	},
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}A33WjART8CQdkmeY`,
		type: 'ancestryBonus',
		names: ['wily'],
		rules: WILY_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}1y4RJSu2xmimR26x`,
		type: 'feature',
		names: ['unstoppable brutality'],
		classIdentifier: 'berserker',
		rules: UNSTOPPABLE_BRUTALITY_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}Wh8QAe0TSjpgEJFr`,
		type: 'feature',
		names: ['inerrant strike.', 'inerrant strike'],
		classIdentifier: 'commander',
		rules: INERRANT_STRIKE_RULES,
		name: { from: 'Inerrant Strike.', to: 'Inerrant Strike' },
	},
];

function toPackSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	return snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)
		? `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`
		: snapshotId;
}

function withoutKeys(rule: RuleSource, keys: string[]): RuleSource {
	return Object.fromEntries(Object.entries(rule).filter(([key]) => !keys.includes(key)));
}

function isForcedReroll(rule: RuleSource): boolean {
	return rule?.type === 'modifyIncomingAttack' && rule.modifier === 'forceReroll';
}

function toRerollRule(old: RuleSource): RuleSource {
	const trigger = typeof old.rerollTrigger === 'string' ? old.rerollTrigger : '';
	const { suppressActivationCard, ...fields } = withoutKeys(
		reroll({
			outcome: OLD_TRIGGERS.has(trigger) ? trigger : 'always',
			rollModeChange: old.rerollWithDisadvantage === true ? -1 : 0,
			automatic: old.automatic === true,
		}),
		BASE_KEYS,
	);

	return { suppressActivationCard, ...withoutKeys(old, INCOMING_ATTACK_KEYS), ...fields };
}

/**
 * Converts each stored forced reroll (a `modifyIncomingAttack` rule with the
 * removed `forceReroll` mode) into a `reroll` rule for the target, at the same
 * place in the list, and removes the forced reroll keys from the other
 * `modifyIncomingAttack` rules.
 *
 * Then brings copies of six pack items to what the pack now ships: Mountain's
 * Endurance and Pocket Sand get the new fields on their converted rule, Pocket
 * Sand gets its charge pool, and Strength of Stone, Wily, Unstoppable Brutality
 * and Inerrant Strike get their reroll rules and pools. Matched on compendium
 * source id, falling back to type, class and name for a copy stripped of one.
 * A pack rule is added unless a rule with its id is there. No pack rule is
 * added beside a reroll rule of the GM's own, and a pack pool and the rules that
 * read it stay out beside a charge rule of the GM's own. A second run changes
 * nothing.
 */
class Migration068RerollRule extends MigrationBase {
	static override readonly version = 68;

	override readonly version = Migration068RerollRule.version;

	override async updateItem(source: any): Promise<void> {
		const system = source?.system;
		if (!system || typeof system !== 'object') return;

		const spec = this.#match(source);
		if (system.rules == null && spec?.rules) system.rules = [];
		const rules = system.rules;
		if (!Array.isArray(rules)) return;

		const converted = this.#convertForcedRerolls(rules);
		const removed = this.#removeLeftoverKeys(rules);

		const updated = spec
			? [
					this.#addRules(rules, spec),
					this.#changeConverted(rules, spec, converted),
					this.#rename(source, spec),
				].some(Boolean)
			: false;

		if (converted.size === 0 && !removed && !updated) return;
		console.log(`Nimble Migration | ${source.name}: updated for the Reroll rule`);
	}

	#convertForcedRerolls(rules: RuleSource[]): Set<RuleSource> {
		const converted = new Set<RuleSource>();
		rules.forEach((rule, index) => {
			if (!isForcedReroll(rule)) return;
			const replacement = toRerollRule(rule);
			rules.splice(index, 1, replacement);
			converted.add(replacement);
		});
		return converted;
	}

	#removeLeftoverKeys(rules: RuleSource[]): boolean {
		let changed = false;
		for (const rule of rules) {
			if (rule?.type !== 'modifyIncomingAttack') continue;
			for (const key of REMOVED_KEYS) {
				if (!(key in rule)) continue;
				delete rule[key];
				changed = true;
			}
		}
		return changed;
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
		if (spec.rulesNeedRuleId && !rules.some((rule) => rule?.id === spec.rulesNeedRuleId)) {
			return false;
		}
		if (this.#hasOwnReroll(rules, spec)) return false;
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
	#hasOwnReroll(rules: RuleSource[], spec: PackItemSpec): boolean {
		const packIds = new Set<unknown>([
			...(spec.rules ?? []).map((rule) => rule.id),
			spec.converted?.id,
			spec.rulesNeedRuleId,
		]);
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

	#changeConverted(rules: RuleSource[], spec: PackItemSpec, converted: Set<RuleSource>): boolean {
		if (!spec.converted) return false;
		const target = rules.find((rule) => converted.has(rule) && rule.id === spec.converted?.id);
		if (!target) return false;

		for (const [key, value] of Object.entries(spec.converted.changes)) {
			if (key === 'chargePoolIdentifier' && !this.#hasPool(rules, value)) continue;
			target[key] = value;
		}
		return true;
	}

	#hasPool(rules: RuleSource[], identifier: unknown): boolean {
		return rules.some((rule) => rule?.type === 'chargePool' && rule.identifier === identifier);
	}

	#rename(source: any, spec: PackItemSpec): boolean {
		if (!spec.name || source.name !== spec.name.from) return false;
		source.name = spec.name.to;
		return true;
	}
}

export { Migration068RerollRule };
