import { MigrationBase } from '../MigrationBase.js';

const HUNTERS_MARK_SOURCE_ID = 'Compendium.nimble.class-features.Item.iDYdYYMzgculnANa';
const NEMESIS_SOURCE_ID = 'Compendium.nimble.class-features.Item.Wyiz02wruaCYqHiN';

// Canonical rule shapes mirroring the pack JSON after Hunter's Mark was
// automated (markTarget + conditionalBonus + note) and Nemesis raised the
// quarry cap. Kept in sync with:
//   packs/classFeatures/core/hunter/hunter-progression/hunters-mark.json
//   packs/classFeatures/core/hunter/hunter-progression/nemesis.json

const HUNTERS_MARK_RULES = [
	{
		type: 'markTarget',
		disabled: false,
		id: 'hunters-mark-toggle',
		identifier: '',
		label: 'Mark Quarry',
		predicate: {},
		priority: 1,
		flagKey: 'quarry',
		statusCondition: 'marked',
		maxTargets: 1,
	},
	{
		type: 'conditionalBonus',
		disabled: false,
		id: 'hunters-mark-bonus',
		identifier: '',
		label: "Hunter's Mark",
		predicate: {},
		priority: 1,
		advantage: 1,
		damageBonus: '@level',
		damageType: '',
		delivery: 'any',
		source: 'any',
		targetCondition: { $and: ['target:quarry'] },
	},
	{
		type: 'note',
		disabled: false,
		id: 'hunters-mark-hidden',
		identifier: '',
		label: "Hunter's Mark",
		predicate: {},
		priority: 1,
		description: "<p>Your marked quarry can't be hidden from you.</p>",
		target: [],
		title: "Hunter's Mark",
		visibility: 'all',
	},
];

const NEMESIS_RULES = [
	{
		type: 'markTarget',
		disabled: false,
		id: 'nemesis-unlimited-quarry',
		identifier: '',
		label: 'Nemesis',
		predicate: {},
		priority: 1,
		flagKey: 'quarry',
		statusCondition: 'marked',
		maxTargets: 0,
	},
];

type RuleSource = { id?: unknown; [key: string]: unknown };

/**
 * Backfills the Hunter's Mark automation rules onto embedded copies of the two
 * Hunter progression features that gained them:
 *
 * - **Hunter's Mark** — the `markTarget` rule that tags a quarry (and applies
 *   the visible `marked` marker), the `conditionalBonus` that offers advantage
 *   or +LVL damage against that quarry, and the `note` for "can't be hidden".
 * - **Nemesis** — the `markTarget` rule with `maxTargets: 0` that lifts the
 *   quarry cap to unlimited.
 *
 * Both previously shipped with `rules: []`, so existing character copies have
 * no automation until reconciled here. Matches on compendium source id first,
 * falling back to hunter class + item name for copies without one (mirrors
 * Migration027's strategy for progression-granted items). Each rule is
 * replace-or-inserted by id, so partial or older copies are upgraded and the
 * migration is idempotent.
 */
class Migration030HuntersMarkRules extends MigrationBase {
	static override readonly version = 30;

	override readonly version = Migration030HuntersMarkRules.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;
		const sourceId = this.getSourceId(source);

		if (this.#matches(source, sourceId, HUNTERS_MARK_SOURCE_ID, "hunter's mark")) {
			this.#applyRules(source, HUNTERS_MARK_RULES);
			return;
		}

		if (this.#matches(source, sourceId, NEMESIS_SOURCE_ID, 'nemesis')) {
			this.#applyRules(source, NEMESIS_RULES);
		}
	}

	/**
	 * Match by compendium source id first. Fall back to hunter class + name for
	 * copies without a compendium source (progression-granted or hand-added
	 * items), which the strict match misses.
	 */
	#matches(
		source: any,
		sourceId: string | undefined,
		expectedSourceId: string,
		normalizedName: string,
	): boolean {
		if (sourceId === expectedSourceId) return true;
		if (source?.system?.class !== 'hunter') return false;
		return typeof source.name === 'string' && source.name.trim().toLowerCase() === normalizedName;
	}

	#applyRules(source: any, canonicalRules: RuleSource[]): void {
		const system = (source.system ??= {} as Record<string, unknown>);
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules = system.rules as RuleSource[];

		for (const canonical of canonicalRules) {
			const index = rules.findIndex((rule) => rule?.id === canonical.id);
			if (index >= 0) {
				rules[index] = foundry.utils.deepClone(canonical);
			} else {
				rules.push(foundry.utils.deepClone(canonical));
			}
		}

		// eslint-disable-next-line no-console
		console.log(`Nimble Migration | ${source.name}: reconciled Hunter's Mark automation rules`);
	}
}

export { Migration030HuntersMarkRules };
