import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	/** Rules the pack now ships, appended when an equivalent is not present. */
	rules: RuleSource[];
}

// Canonical rules the pack now ships for each feature, keyed by compendium
// source id. Rule ids match the pack so migrated copies are identical to
// freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.6xpILHYt5KTSnTtd',
		class: 'commander',
		name: 'coordinated strike!',
		rules: [
			{
				type: 'actionDelta',
				disabled: false,
				id: 'coordinated-strike-as-one',
				identifier: '',
				label: 'As One! (allies gain an action next turn)',
				predicate: {
					subclass: 'champion-of-the-vanguard',
					level: {
						min: 15,
					},
				},
				priority: 4,
				value: '1',
				timing: 'nextTurn',
				target: 'targeted',
				borrowFromNextTurn: false,
			},
			{
				type: 'actionDelta',
				disabled: false,
				id: 'coordinated-strike-unparalleled-tactics',
				identifier: '',
				label: 'Unparalleled Tactics (ally gains an action next turn)',
				predicate: {
					level: {
						min: 18,
						max: 19,
					},
				},
				priority: 4,
				value: '1',
				timing: 'nextTurn',
				target: 'targeted',
				borrowFromNextTurn: false,
			},
			{
				type: 'actionDelta',
				disabled: false,
				id: 'coordinated-strike-captain-of-legions',
				identifier: '',
				label: 'Captain of Legions (all allies gain an action next turn)',
				predicate: {
					level: {
						min: 20,
					},
				},
				priority: 4,
				value: '1',
				timing: 'nextTurn',
				target: 'allAllies',
				borrowFromNextTurn: false,
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
 * Backfills embedded copies of Coordinated Strike with the three action riders
 * the pack gained after the automation pass. Existing actor copies stop at the
 * two free attacks and would otherwise need a manual re-drag from the
 * compendium.
 *
 * All three riders live on Coordinated Strike rather than on the features that
 * grant them, because action deltas are collected from the item being used and
 * there is no cross-item modifier for them. Each is gated by predicate instead,
 * so a Commander who has not earned one carries an inert rule.
 *
 * Matches on compendium source id, falling back to class + item name for copies
 * without one. Idempotent, and purely additive: a rule is appended only when no
 * rule with the same signature is present, so a GM who already built an
 * equivalent rider under one of our ids keeps their version, and nothing they
 * authored is rewritten or removed.
 */
class Migration038CommanderStrikeRiders extends MigrationBase {
	static override readonly version = 38;

	override readonly version = Migration038CommanderStrikeRiders.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		if (this.#appendRules(source, spec.rules)) {
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: added commander action riders`,
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

	#matchFeature(source: any): FeatureSpec | undefined {
		const sourceId = this.getSourceId(source);
		const byId = FEATURES.find((f) => f.sourceId === sourceId);
		if (byId) return byId;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		const cls = source.system?.class;
		return FEATURES.find((f) => f.class === cls && f.name === name);
	}
}

export { Migration038CommanderStrikeRiders };
