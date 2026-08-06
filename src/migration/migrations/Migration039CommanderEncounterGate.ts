import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };

interface RulePredicateExtension {
	/** Pack id of the rule whose predicate gained a key. */
	ruleId: string;
	/** Predicate the pack now ships. */
	predicate: Record<string, unknown>;
	/**
	 * Predicate the pack shipped before, and the only one we are allowed to
	 * replace. Matched in full so a GM's edit aborts the rewrite.
	 */
	supersededPredicate: Record<string, unknown>;
}

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	/** Rules the pack now ships, appended when an equivalent is not present. */
	rules: RuleSource[];
	/** Predicate rewrites for rules an earlier migration already added. */
	predicateExtensions: RulePredicateExtension[];
}

/**
 * Predicate clause requiring the shared once-per-encounter pool to still hold a
 * charge. The key is the domain tag charge pool state emits for its current
 * count: `self:` plus the pool identifier plus a `ChargePool` suffix.
 */
const ENCOUNTER_CHARGE_AVAILABLE = {
	'self:coordinated-strike-encounterChargePool': {
		min: 1,
	},
};

// Canonical rules and predicates the pack now ships for each feature, keyed by
// compendium source id. Rule ids match the pack so migrated copies behave
// identically to freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.6xpILHYt5KTSnTtd',
		class: 'commander',
		name: 'coordinated strike!',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'coordinated-strike-encounter-pool',
				identifier: 'coordinated-strike-encounter',
				label: 'Coordinated Strike (1/encounter)',
				predicate: {
					level: {
						min: 18,
					},
				},
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
				id: 'coordinated-strike-encounter-consumer',
				identifier: '',
				label: '',
				predicate: {
					level: {
						min: 18,
					},
					...ENCOUNTER_CHARGE_AVAILABLE,
				},
				priority: 2,
				poolIdentifier: 'coordinated-strike-encounter',
				poolScope: 'item',
				cost: '1',
			},
		],
		predicateExtensions: [
			{
				ruleId: 'coordinated-strike-unparalleled-tactics',
				predicate: {
					level: {
						min: 18,
						max: 19,
					},
					...ENCOUNTER_CHARGE_AVAILABLE,
				},
				supersededPredicate: {
					level: {
						min: 18,
						max: 19,
					},
				},
			},
			{
				ruleId: 'coordinated-strike-captain-of-legions',
				predicate: {
					level: {
						min: 20,
					},
					...ENCOUNTER_CHARGE_AVAILABLE,
				},
				supersededPredicate: {
					level: {
						min: 20,
					},
				},
			},
		],
	},
];

/**
 * Signature identifying a rule for dedupe. Keyed on the rule's canonical pack
 * id when present, falling back to type plus its primary target field so
 * hand-added equivalents are not duplicated.
 */
function ruleSignature(rule: RuleSource): string {
	if (typeof rule.id === 'string' && rule.id.length > 0) return `id:${rule.id}`;
	const target =
		(rule as { poolIdentifier?: unknown }).poolIdentifier ??
		(rule as { identifier?: unknown }).identifier ??
		'';
	return `${String(rule.type)}:${String(target)}`;
}

/**
 * Structural equality for plain JSON data.
 *
 * A rule predicate is stored as a raw object (`ObjectField`), so an untouched
 * embedded copy still holds it exactly as the pack authored it. That makes full
 * equality a usable fingerprint: any difference at all means someone edited the
 * predicate, and the safe response is to leave it alone.
 */
function isSameJson(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((entry, index) => isSameJson(entry, b[index]));
	}
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) return false;
	return leftKeys.every((key) => key in right && isSameJson(left[key], right[key]));
}

/**
 * Gates the two Coordinated Strike capstones to once per encounter on embedded
 * copies. Unparalleled Tactics and Captain of Legions are both worded as firing
 * the first time each encounter the order is used, but as shipped they granted
 * an action on every use.
 *
 * The pack now hangs a one-charge pool off Coordinated Strike that refreshes at
 * encounter start, with a consumer that spends it, and both riders predicate on
 * that pool still holding a charge. Everything here is gated to level 18 and up,
 * including the pool, so a lower level Commander carries no badge for a feature
 * they do not have.
 *
 * Matches on compendium source id, falling back to class + item name for copies
 * without one. Idempotent, and deliberately conservative about overwriting: the
 * pool and its consumer are appended only when no rule with the same signature
 * is present, and a rider's predicate is rewritten only while it still holds
 * exactly what the pack shipped before this change. A GM who retuned the level
 * band, added a clause of their own, or built their own once-per-encounter gate
 * keeps their version. Worlds arriving from either the previous migration or a
 * fresh compendium drag land in the same place: a fresh copy already carries the
 * new predicate, which no longer matches the superseded one, so it is left as
 * it is.
 */
class Migration039CommanderEncounterGate extends MigrationBase {
	static override readonly version = 39;

	override readonly version = Migration039CommanderEncounterGate.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		let changed = this.#appendRules(source, spec.rules);
		changed = this.#extendPredicates(source, spec.predicateExtensions) || changed;

		if (changed) {
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: gated the commander capstones to once per encounter`,
			);
		}
	}

	#appendRules(source: any, specRules: RuleSource[]): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);
		const present = new Set(rules.map((rule) => ruleSignature(rule)));

		let changed = false;
		for (const rule of specRules) {
			if (present.has(ruleSignature(rule))) continue;
			rules.push(foundry.utils.deepClone(rule));
			present.add(ruleSignature(rule));
			changed = true;
		}
		return changed;
	}

	#extendPredicates(source: any, extensions: RulePredicateExtension[]): boolean {
		const rules = source.system?.rules as RuleSource[] | undefined;
		if (!Array.isArray(rules)) return false;

		let changed = false;
		for (const { ruleId, predicate, supersededPredicate } of extensions) {
			const rule = rules.find((candidate) => candidate.id === ruleId);
			if (!rule) continue;
			if (!isSameJson(rule.predicate, supersededPredicate)) continue;
			rule.predicate = foundry.utils.deepClone(predicate);
			changed = true;
		}
		return changed;
	}

	#matchFeature(source: any): FeatureSpec | undefined {
		const sourceId = this.getSourceId(source);
		const byId = FEATURES.find((f) => f.sourceId === sourceId);
		if (byId) return byId;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		const cls = source.system?.class;
		return FEATURES.find((f) => f.class === cls && f.name === name);
	}
}

export { Migration039CommanderEncounterGate };
