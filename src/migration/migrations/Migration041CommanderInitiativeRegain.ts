import { MigrationBase } from '../MigrationBase.js';

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
 * when the actor rolls initiative. `add` is clamped at the pool max on the way
 * in, so a full pool gains nothing, which is what "regain a spent use" means.
 */
const INITIATIVE_REGAIN = {
	trigger: 'onInitiativeRolled',
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

function ruleSignature(rule: RuleSource): string {
	if (typeof rule.id === 'string' && rule.id.length > 0) return `id:${rule.id}`;
	const target =
		(rule as { poolIdentifier?: unknown }).poolIdentifier ??
		(rule as { identifier?: unknown }).identifier ??
		'';
	return `${String(rule.type)}:${String(target)}`;
}

/**
 * Backfills the two features that hand the Coordinated Strike use pool back a
 * use when their owner rolls initiative. Both are pool modifiers contributing a
 * recovery entry, which the charge pool path only started reading alongside
 * this migration; until then neither clause could be expressed at all, so no
 * existing copy has any form of it.
 *
 * Matches on compendium source id, falling back to class + item name for copies
 * without one. Idempotent, and appends only: a rule with the same signature
 * already present is left as the GM has it.
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
		const present = new Set(existing.map((rule) => ruleSignature(rule)));

		let changed = false;
		for (const rule of rules) {
			if (present.has(ruleSignature(rule))) continue;
			existing.push(foundry.utils.deepClone(rule));
			present.add(ruleSignature(rule));
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

export { Migration041CommanderInitiativeRegain };
