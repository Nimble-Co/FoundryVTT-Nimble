import { MigrationBase } from '../MigrationBase.js';

/** Namespace the source ids below are written under. */
const SNAPSHOT_PREFIX = 'Compendium.nimble.';

/** Every namespace a stored id could carry: the stable id, or the dev rebrand. */
const STORED_PREFIXES = [SNAPSHOT_PREFIX, 'Compendium.nimble-dev.'];

/**
 * Folds a stored source id onto the namespace the specs use. `dev-rebrand.mjs`
 * rewrites `packs/**` but not `src/**`, so on the dev build an actor's stored id
 * reads `Compendium.nimble-dev.…` and would never match a literal written here.
 * The document ids are identical across both installs, so the fold is exact.
 */
function toSnapshotId(packSource: string | undefined): string | undefined {
	if (!packSource) return packSource;
	const prefix = STORED_PREFIXES.find((candidate) => packSource.startsWith(candidate));
	return prefix ? `${SNAPSHOT_PREFIX}${packSource.slice(prefix.length)}` : packSource;
}

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	/** Rules the pack now ships, appended when an equivalent is not present. */
	rules: RuleSource[];
}

/**
 * Recovery entry contributed to the Coordinated Strike use pool: one use back
 * at the start of an encounter, which is when initiative is rolled. `add` is
 * clamped at the pool max on the way in, so a full pool gains nothing, which is
 * what "regain a spent use" means.
 *
 * Deliberately not `onInitiativeRolled`, which the rules text names: that
 * trigger fires once per initiative roll per combatant with no dedup, so
 * re-rolling initiative would hand out a second use. `encounterStart` is
 * dispatched once per combat.
 */
const INITIATIVE_REGAIN = {
	trigger: 'encounterStart',
	mode: 'add',
	value: '1',
	predicate: {},
};

// Canonical rules the pack now ships for each feature, keyed by compendium
// source id. Rule ids match the pack so migrated copies behave identically to
// freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.qbrHOGpSY2thczfu',
		class: 'commander',
		name: 'master commander',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'master-commander-initiative-regain',
				identifier: '',
				label: 'Master Commander: regain 1 use of Coordinated Strike on initiative',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'coordinated-strike-uses',
				dieSize: null,
				maxDelta: null,
				addRefills: [INITIATIVE_REGAIN],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.4Iu4tRnP8kBJd2ra',
		class: 'commander',
		name: 'survey the battlefield.',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'survey-the-battlefield-initiative-regain',
				identifier: '',
				label: 'Survey the Battlefield: regain 1 use of Coordinated Strike on initiative',
				predicate: {},
				priority: 2,
				poolType: 'charge',
				poolIdentifier: 'coordinated-strike-uses',
				dieSize: null,
				maxDelta: null,
				addRefills: [INITIATIVE_REGAIN],
			},
		],
	},
];

/**
 * Identity for "this rule is already here". Every rule this migration adds
 * carries an id, so the id is the whole of it: a shape-based fallback could
 * never match one of them and would only read as a safety net that is not one.
 */
function ruleId(rule: RuleSource): string {
	return typeof rule.id === 'string' ? rule.id : '';
}

/**
 * Backfills the two features that hand the Coordinated Strike use pool back a
 * use when their owner rolls initiative. Both are pool modifiers contributing a
 * recovery entry, which the charge pool path only started reading alongside
 * this migration; until then neither clause could be expressed at all, so no
 * existing copy has any form of it.
 *
 * Matches on compendium source id, falling back to class + item name for copies
 * without one. Appends only, and idempotent across repeat runs: a rule carrying
 * the same id is never added twice.
 *
 * Note the limit of that check. It keys on the rule id, so a GM who worked
 * around the missing automation by hand-authoring an equivalent modifier under
 * their own id gets a second one appended, and both recoveries then apply. There
 * is no reliable shape signature to test instead: a modifier is only three
 * fields plus its entries, so an unrelated rule that happens to match them is
 * indistinguishable from a duplicate.
 */
class Migration041CommanderInitiativeRegain extends MigrationBase {
	static override readonly version = 41;

	override readonly version = Migration041CommanderInitiativeRegain.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		if (this.#appendRules(source, spec.rules)) {
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: added initiative use recovery`,
			);
		}
	}

	#appendRules(source: any, rules: RuleSource[]): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const existing: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);
		const present = new Set(existing.map((rule) => ruleId(rule)).filter((id) => id.length > 0));

		let changed = false;
		for (const rule of rules) {
			const id = ruleId(rule);
			if (present.has(id)) continue;
			existing.push(foundry.utils.deepClone(rule));
			present.add(id);
			changed = true;
		}
		return changed;
	}

	#matchFeature(source: any): FeatureSpec | undefined {
		const sourceId = toSnapshotId(this.getSourceId(source));
		const byId = FEATURES.find((f) => f.sourceId === sourceId);
		if (byId) return byId;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		const cls = source.system?.class;
		return FEATURES.find((f) => f.class === cls && f.name === name);
	}
}

export { Migration041CommanderInitiativeRegain };
