import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; modifier?: unknown };

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	rules: RuleSource[];
}

// Canonical rules the pack now ships for each feature, keyed by compendium
// source id. Rule ids match the pack so migrated copies are identical to
// freshly dragged ones.
const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Lo6AEKT7eppws7YI',
		class: 'oathsworn',
		name: 'aura of refuge',
		rules: [
			{
				type: 'armorClass',
				disabled: false,
				id: '8UnnMpfPiHgPnPla',
				identifier: '',
				label: '',
				predicate: { self: 'shield' },
				priority: 1,
				formula: '@willpower',
				mode: 'add',
			},
			{
				type: 'modifyIncomingAttack',
				disabled: false,
				id: 'ePC8z2QmXucSUUbm',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				modifier: 'redirectToSelf',
				range: 4,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.MM8MxrvZ7jnoGOa8',
		class: 'the-cheat',
		name: 'pocket sand',
		rules: [
			{
				type: 'modifyIncomingAttack',
				disabled: false,
				id: 'CqGMYxQoLrVI17x3',
				identifier: '',
				label: '',
				predicate: {},
				priority: 1,
				modifier: 'forceReroll',
				range: 2,
				rerollTrigger: 'always',
				rerollWithDisadvantage: true,
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.CLAQBXSaK5TgFsmN',
		class: 'berserker',
		name: "mountain's endurance",
		rules: [
			{
				type: 'modifyIncomingAttack',
				disabled: false,
				id: '2t2MTnfR7EJBX5LP',
				identifier: '',
				label: '',
				predicate: { self: 'dying' },
				priority: 1,
				modifier: 'forceReroll',
				range: 2,
				automatic: true,
				rerollTrigger: 'criticalHit',
			},
		],
	},
];

/** Signature identifying a rule for dedupe: modifyIncomingAttack by modifier, others by type. */
function ruleSignature(rule: RuleSource): string {
	return rule.type === 'modifyIncomingAttack'
		? `modifyIncomingAttack:${String(rule.modifier)}`
		: String(rule.type);
}

/**
 * Backfills embedded copies of Aura of Refuge, Pocket Sand, and Mountain's
 * Endurance with the modifyIncomingAttack rules (and Aura's shield armorClass
 * rule) the pack now ships (#583). Existing actor copies predate the rules and
 * would otherwise need a manual re-drag from the compendium.
 *
 * Matches on compendium source id, falling back to class + item name for
 * copies without one. Idempotent: only rules whose signature is not already
 * present are appended, so hand-added or previously-migrated rules are kept.
 */
class Migration031ModifyIncomingAttackFeatures extends MigrationBase {
	static override readonly version = 31;

	override readonly version = Migration031ModifyIncomingAttackFeatures.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);
		const present = new Set(rules.map(ruleSignature));

		let changed = false;
		for (const rule of spec.rules) {
			if (present.has(ruleSignature(rule))) continue;
			rules.push(foundry.utils.deepClone(rule));
			present.add(ruleSignature(rule));
			changed = true;
		}

		if (changed) {
			// eslint-disable-next-line no-console
			console.log(
				`Nimble Migration | ${source.name ?? spec.sourceId}: added incoming-attack rules`,
			);
		}
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

export { Migration031ModifyIncomingAttackFeatures };
