import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown };

interface ChargePoolPresentationChange {
	/** Pack id of the charge pool rule whose presentation changed. */
	ruleId: string;
	/** Label the pack now ships. */
	label: string;
	/** Visibility the pack now ships. */
	hidden: boolean;
	/**
	 * Label the pack shipped before, and the only one we are allowed to replace.
	 * Matched exactly so a GM's retitle aborts the rewrite.
	 */
	supersededLabel: string;
	/**
	 * Visibility the pack shipped before. Matched alongside the label so both
	 * fields move together or neither does.
	 */
	supersededHidden: boolean;
}

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	poolChanges: ChargePoolPresentationChange[];
}

// Canonical labels and visibility the pack now ships for each feature, keyed by
// compendium source id. Rule ids match the pack so migrated copies behave
// identically to freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.6xpILHYt5KTSnTtd',
		class: 'commander',
		name: 'coordinated strike!',
		poolChanges: [
			{
				ruleId: 'coordinated-strike-round-pool',
				label: 'Coordinated Strike (once per round)',
				hidden: true,
				supersededLabel: 'Coordinated Strike (1/round)',
				supersededHidden: false,
			},
			{
				ruleId: 'coordinated-strike-encounter-pool',
				label: 'Coordinated Strike (first use each encounter)',
				hidden: true,
				supersededLabel: 'Coordinated Strike (1/encounter)',
				supersededHidden: false,
			},
		],
	},
];

/**
 * Visibility a stored rule expresses. Only an explicit `true` hides a pool, so a
 * rule authored before the field existed reads as visible, which is exactly the
 * state the pack shipped it in.
 */
function isHidden(value: unknown): boolean {
	return value === true;
}

/**
 * Hides the two Coordinated Strike gate pools and retitles them on embedded
 * copies.
 *
 * The order carried three pool badges that all ticked down on a single use: the
 * budget of INT uses per Safe Rest, the once-per-round limit, and the first-use-
 * each-encounter gate the level 18 and 20 riders read. Side by side they look
 * like separate budgets that add up, so a player counts one more use than they
 * have. Only the first is a budget; the other two are gates. The gates are now
 * hidden, and the encounter gate is retitled because "1/encounter" claimed the
 * whole order was once per encounter rather than naming what the gate covers.
 *
 * Hiding changes presentation only. A hidden pool is still tracked, recovered,
 * validated and spent, still names itself when it refuses an activation, and
 * still reports on the chat card.
 *
 * Matches on compendium source id, falling back to class + item name for copies
 * without one. Idempotent, and deliberately conservative: a pool is rewritten
 * only while it still holds exactly the label and visibility the pack shipped
 * before this change, and both fields move together or neither does. A GM who
 * retitled a gate, or who took the new pack version and unhid a gate, keeps
 * their version. A freshly dragged copy already carries the new label, which no
 * longer matches the superseded one, so it is left as it is.
 *
 * The budget pool is untouched. The pack now spells out `hidden: false` on it,
 * but an absent flag already reads as visible, so there is nothing to migrate.
 */
class Migration040CommanderHiddenGatePools extends MigrationBase {
	static override readonly version = 40;

	override readonly version = Migration040CommanderHiddenGatePools.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		if (this.#applyPoolChanges(source, spec.poolChanges)) {
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: hid the coordinated strike gate pools`,
			);
		}
	}

	#applyPoolChanges(source: any, poolChanges: ChargePoolPresentationChange[]): boolean {
		const rules = source.system?.rules as RuleSource[] | undefined;
		if (!Array.isArray(rules)) return false;

		let changed = false;
		for (const change of poolChanges) {
			const rule = rules.find((candidate) => candidate.id === change.ruleId);
			if (!rule) continue;
			if (rule.label !== change.supersededLabel) continue;
			if (isHidden(rule.hidden) !== change.supersededHidden) continue;

			rule.label = change.label;
			rule.hidden = change.hidden;
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

export { Migration040CommanderHiddenGatePools };
