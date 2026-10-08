import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };

const COMPENDIUM_PREFIX = 'Compendium.';

/** The Savage Awareness rule the pack now ships, id included, so migrated copies behave identically. */
const SAVAGE_AWARENESS_RULE: RuleSource = {
	type: 'situationalRollMode',
	disabled: false,
	id: 'savage-awareness-perception',
	identifier: '',
	label: 'To notice or track down blood',
	predicate: {},
	priority: 1,
	value: 1,
	checkType: 'skillCheck',
	saves: [],
	abilities: [],
	skills: ['perception'],
};

interface RuleCorrection {
	/** The rule the pack shipped before this migration, field for field. */
	old: RuleSource;
	/** What takes its place, or nothing when the pack now ships no rule for the clause. */
	replacement?: RuleSource;
}

interface DescriptionCorrection {
	old: string;
	replacement: string;
}

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	corrections: RuleCorrection[];
	description?: DescriptionCorrection;
}

const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.nApqsHzgRQJ7vTgb',
		class: 'berserker',
		name: 'savage awareness',
		corrections: [
			{
				old: {
					type: 'skillRollMode',
					disabled: false,
					id: 'savage-awareness-perception',
					identifier: '',
					label: 'Savage Awareness (Perception, blood only)',
					predicate: {},
					priority: 1,
					value: 1,
					skills: ['perception'],
					mode: 'adjust',
				},
				replacement: SAVAGE_AWARENESS_RULE,
			},
		],
		description: {
			old: '<p>Advantage on Perception checks to notice or track down blood. Blindsight 2 while Raging: you ignore the Blinded condition and can see through darkness and Invisibility within that Range.</p><p><em>The Perception advantage is pre-set on the roll dialog for blood-related checks; dial it back for other Perception checks. Blindsight is not automated.</em></p>',
			replacement:
				'<p>Advantage on Perception checks to notice or track down blood. Blindsight 2 while Raging: you ignore the Blinded condition and can see through darkness and Invisibility within that Range.</p>',
		},
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Lo6AEKT7eppws7YI',
		class: 'oathsworn',
		name: 'aura of refuge',
		corrections: [
			{
				old: {
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
				replacement: {
					type: 'armorClass',
					disabled: false,
					id: '8UnnMpfPiHgPnPla',
					identifier: '',
					label: '',
					predicate: { self: 'shield' },
					priority: 1,
					formula: '@will',
					mode: 'add',
				},
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.DV7ZXRiXNA6VHEGw',
		class: 'shadowmancer',
		name: 'enveloped by the master',
		corrections: [
			{
				old: {
					type: 'maxWounds',
					disabled: false,
					id: 'NRuKjNvofPWzKu5v',
					identifier: '',
					label: 'Enveloped by the Master',
					predicate: {},
					priority: 1,
					value: '1d4',
				},
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.sBkJM9PbEaS2JDXy',
		class: 'stormshifter',
		name: 'fleet footed',
		corrections: [
			{
				old: {
					type: 'speedBonus',
					value: '2',
					label: 'Fleet Footed',
					id: 'EcMJKDIwbT3q5cP3',
				},
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.JNuZ28Xj5oBFhkEr',
		class: 'stormshifter',
		name: 'winged',
		corrections: [
			{
				old: {
					type: 'speedBonus',
					value: '@attributes.movement.walk',
					movementType: 'fly',
					label: 'Winged',
					id: 'RivdlU4xcZIxnZQt',
				},
			},
		],
	},
];

function deepEquals(left: unknown, right: unknown): boolean {
	if (left === right) return true;

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right)) return false;
		return left.length === right.length && left.every((entry, i) => deepEquals(entry, right[i]));
	}

	if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
		return false;
	}

	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) return false;
	return leftKeys.every((key) =>
		deepEquals((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
	);
}

/** Initial values of the base rule schema, for keys a pack file may leave out. */
const BASE_RULE_DEFAULTS: RuleSource = {
	disabled: false,
	identifier: '',
	label: '',
	predicate: {},
	priority: 1,
	suppressActivationCard: 'auto',
};

/**
 * True when the stored rule still holds every value the pack wrote into it.
 *
 * A key the pack wrote must match. A base key the pack left out must still hold the
 * schema default, because the data model fills it in on a stored copy: Fleet Footed
 * shipped four keys and comes back with `predicate` and `priority` as well. A GM who
 * gated, disabled or retuned the rule changed one of these, and their copy is left as
 * they set it. Keys of the rule's own schema that the pack left out are not checked.
 */
function isPackRule(rule: RuleSource, old: RuleSource): boolean {
	if (!Object.entries(old).every(([key, value]) => deepEquals(rule[key], value))) return false;
	return Object.entries(BASE_RULE_DEFAULTS).every(
		([key, initial]) => key in old || rule[key] === undefined || deepEquals(rule[key], initial),
	);
}

/**
 * Corrects five class features whose shipped rules did not match the book, on copies
 * already stamped onto actors and world items. Updating the pack alone does not reach
 * one: rules are read from the actor's own items, so an existing character keeps
 * whatever it was built with.
 *
 * Savage Awareness held a `skillRollMode` that gave advantage on every Perception
 * check, while the feature only covers checks to notice or track down blood. It
 * becomes the `situationalRollMode` the roller opts into per check, as in
 * Migration045HauntedPastFearAdvantage and Migration047SurvivalistPoisonSave. The old
 * rule wrote to prepared data only, so nothing stored needs cleaning up after it.
 *
 * Aura of Refuge asked for `@willpower`, which is not a roll data key. The ability is
 * `will`, so the shield armour bonus resolved to nothing.
 *
 * Enveloped by the Master held a `maxWounds` rule, which raises how many Wounds a
 * character survives. The feature is the opposite: 1d4 Wounds are the price of casting
 * Dragonform, and they are taken at cast time, so nothing replaces it.
 *
 * Fleet Footed and Winged are Chimeric Boons, which apply only to a Direbeast form the
 * character chose to modify with that boon. Both shipped an always-on speed bonus.
 * There is no shapeshift state to predicate on, so the rules are dropped and the boons
 * read from their description, as the other Chimeric Boons already do.
 *
 * Every write is gated on the stored value still being the one the pack wrote. A rule
 * or description the GM edited is left alone, and a rule the GM added beside the
 * shipped one is kept. That gate also makes the migration idempotent: a second run
 * finds no pack value left to correct.
 */
class Migration053PackRuleCorrections extends MigrationBase {
	static override readonly version = 53;

	override readonly version = Migration053PackRuleCorrections.version;

	/**
	 * A compendium id identifies the feature outright, so a same-named feature from
	 * another pack is left alone. A copy without one, which is what the sidebar stamps
	 * on a world item, falls back to class plus name.
	 */
	#matchFeature(source: any): FeatureSpec | undefined {
		if (source?.type !== 'feature') return undefined;

		const sourceId = toSnapshotId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return FEATURES.find((spec) => spec.sourceId === sourceId);
		}

		const name = String(source.name ?? '')
			.trim()
			.toLowerCase();
		return FEATURES.find((spec) => spec.name === name && spec.class === source.system?.class);
	}

	/** Rewrites each shipped rule in place, so rules the GM added keep their order. */
	#correctRules(system: any, spec: FeatureSpec): boolean {
		if (!Array.isArray(system.rules)) return false;
		const rules: RuleSource[] = system.rules;

		let changed = false;
		for (const correction of spec.corrections) {
			const index = rules.findIndex((rule) => rule && isPackRule(rule, correction.old));
			if (index === -1) continue;

			if (correction.replacement)
				rules.splice(index, 1, foundry.utils.deepClone(correction.replacement));
			else rules.splice(index, 1);
			changed = true;
		}
		return changed;
	}

	#correctDescription(system: any, spec: FeatureSpec): boolean {
		if (!spec.description) return false;
		if (system.description !== spec.description.old) return false;

		system.description = spec.description.replacement;
		return true;
	}

	/** Called for world items, and for each embedded item with its actor as `parent`. */
	override async updateItem(source: any): Promise<void> {
		const spec = this.#matchFeature(source);
		if (!spec || !source.system) return;

		const rulesChanged = this.#correctRules(source.system, spec);
		const descriptionChanged = this.#correctDescription(source.system, spec);

		if (rulesChanged || descriptionChanged) {
			console.log(`Nimble Migration | ${source.name ?? spec.name}: corrected to match the book`);
		}
	}
}

export { Migration053PackRuleCorrections };
