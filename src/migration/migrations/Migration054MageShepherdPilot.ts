import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };

/**
 * Snapshots of what the packs now ship, ids included, so a migrated copy and a
 * fresh one from the compendium behave identically. Each one is asserted equal
 * to its pack JSON in the test beside this file.
 */
const TALENTED_RESEARCHER_RULES: RuleSource[] = [
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'ooL7uIbWUtIyO0LR',
		identifier: '',
		label: 'With many books and time to study them',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['arcana', 'lore'],
	},
];

const SEARING_LIGHT_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'XT0h4EYadjuZKMUT',
		identifier: 'searing-light',
		label: 'Searing Light',
		predicate: {},
		priority: 1,
		scope: 'actor',
		max: 'max(@will, 0)',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: true,
		recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'Kgtq6K1KQkOUtMYX',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'searing-light',
		poolScope: 'actor',
		cost: '1',
	},
];

const SPELL_SHAPER_DESCRIPTION =
	'<p>You gain the ability to enhance your spells with powerful effects by spending additional mana. Choose 2 Spellshaper abilities. You may use 1/turn.</p><hr><p>Level 9: Choose 1 additional Spellshaper ability.</p><p>Level 13: Choose 1 additional Spellshaper ability.</p>';

const SACRED_GRACES_DESCRIPTION =
	'<p>Choose 2 Sacred Graces.</p><hr><p>Level 9: Choose a 3rd Sacred Grace.</p><p>Level 13: Choose a 4th Sacred Grace.</p>';

/** The material component line the pack no longer carries, double space and all. */
const LIFEBINDING_SPIRIT_OLD_COST_DETAILS = 'A diamond  worth at least 10,000 gp';

interface ItemSpec {
	sourceId: string;
	type: string;
	/** The class identifier the feature belongs to. A spell carries none. */
	class?: string;
	/** Lowercased, for the name fallback. */
	name: string;
	/** Returns the log line when it changed the item, nothing when it did not. */
	apply: (source: any) => string | undefined;
}

function ruleId(rule: RuleSource): string | undefined {
	return typeof rule?.id === 'string' ? rule.id : undefined;
}

/**
 * Adds the pack's rules unless the item already carries them or something that
 * does the same job. All or nothing: the rules of one feature describe a single
 * mechanic, so a half-migrated item would either double a pool or leave a
 * consumer pointing at nothing.
 */
function addRules(
	source: any,
	rules: RuleSource[],
	isEquivalent: (rule: RuleSource) => boolean,
): boolean {
	const system = (source.system ??= {} as Record<string, unknown>);
	const existing: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);

	const packIds = new Set(rules.map((rule) => ruleId(rule)));
	const alreadyPresent = existing.some(
		(rule) => (ruleId(rule) !== undefined && packIds.has(ruleId(rule))) || isEquivalent(rule),
	);
	if (alreadyPresent) return false;

	for (const rule of rules) existing.push(foundry.utils.deepClone(rule));
	return true;
}

/**
 * Fills in a description the pack left empty. A copy that already says
 * something keeps it, whether that is a GM's own wording or a later pack text.
 */
function fillDescription(source: any, description: string): boolean {
	const system = (source.system ??= {} as Record<string, unknown>);
	const current = system.description;
	if (typeof current === 'string' && current.trim().length > 0) return false;

	system.description = description;
	return true;
}

/** The old line shipped with a doubled space, so spacing is not held against a copy. */
function isOldCostDetails(details: string): boolean {
	const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
	return normalize(details) === normalize(LIFEBINDING_SPIRIT_OLD_COST_DETAILS);
}

const ITEMS: ItemSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.WN4gldrDqbvGcNOl',
		type: 'feature',
		class: 'mage',
		name: 'talented researcher',
		apply: (source) =>
			addRules(
				source,
				TALENTED_RESEARCHER_RULES,
				// A GM may have authored the same advantage by hand while the pack
				// shipped nothing for it. Only a rule that offers advantage on both
				// skills counts; a disadvantage or a single-skill rule is other homebrew.
				(rule) =>
					rule?.type === 'situationalRollMode' &&
					rule?.checkType === 'skillCheck' &&
					rule?.value === 1 &&
					Array.isArray(rule?.skills) &&
					(TALENTED_RESEARCHER_RULES[0].skills as string[]).every((skill) =>
						(rule.skills as unknown[]).includes(skill),
					),
			)
				? 'added the study bonus on Arcana and Lore checks'
				: undefined,
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.KQiBYDr1BBTE0iJq',
		type: 'feature',
		class: 'shepherd',
		name: 'searing light',
		apply: (source) =>
			addRules(
				source,
				SEARING_LIGHT_RULES,
				// A pool or consumer already keyed to this feature's identifier is a
				// GM's own version of the same mechanic; one aimed elsewhere is not.
				(rule) =>
					(rule?.type === 'chargePool' && rule?.identifier === 'searing-light') ||
					(rule?.type === 'chargeConsumer' && rule?.poolIdentifier === 'searing-light'),
			)
				? 'added the use pool and its cost'
				: undefined,
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.l0Mia2jNotcVWVv7',
		type: 'feature',
		class: 'mage',
		name: 'spell shaper',
		apply: (source) =>
			fillDescription(source, SPELL_SHAPER_DESCRIPTION) ? 'added the description' : undefined,
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Bb4zZPJ2xwEgUUcN',
		type: 'feature',
		class: 'shepherd',
		name: 'sacred graces',
		apply: (source) =>
			fillDescription(source, SACRED_GRACES_DESCRIPTION) ? 'added the description' : undefined,
	},
	{
		sourceId: 'Compendium.nimble.nimble-spells.Item.KICmDNpyNoMuZ20E',
		type: 'spell',
		name: 'lifebinding spirit',
		apply: (source) => {
			const cost = source.system?.activation?.cost;
			if (typeof cost?.details !== 'string' || !isOldCostDetails(cost.details)) return undefined;

			cost.details = '';
			return 'cleared the cost details';
		},
	},
];

/**
 * Brings the Mage and Shepherd pack items that the pilot changed up to date on
 * copies that already exist.
 *
 * Updating a pack reaches nothing that a world already holds: an embedded copy
 * on a character, and a world-item copy the GM built characters from, both keep
 * whatever they were stamped with. This migration repairs both, for the study
 * bonus on Talented Researcher, the use pool on Searing Light, the two feature
 * descriptions that shipped empty, and the material component on Lifebinding
 * Spirit that the spell text never asks for.
 *
 * Matched on compendium source id, falling back to class plus name for a copy
 * that lost its id. Idempotent: every change is guarded by the state it
 * produces, so a second run does nothing, and an edit a GM made is kept.
 */
class Migration054MageShepherdPilot extends MigrationBase {
	static override readonly version = 53;

	override readonly version = Migration054MageShepherdPilot.version;

	/** Called for a world item and, with the actor as parent, for an embedded one. */
	override async updateItem(source: any): Promise<void> {
		const spec = this.#match(source);
		if (!spec) return;

		const change = spec.apply(source);
		if (change) console.log(`Nimble Migration | ${source.name ?? spec.name}: ${change}`);
	}

	/**
	 * A compendium id identifies the item outright, so an item from some other
	 * pack is left alone even when it shares a name. Anything else falls back to
	 * the name, which is what a world-item copy or a duplicated world compendium
	 * is left with. The class comes with the name there, so a same-named feature
	 * on another class is still rejected.
	 */
	#match(source: any): ItemSpec | undefined {
		const sourceId = toSnapshotId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return ITEMS.find((spec) => spec.sourceId === sourceId && spec.type === source.type);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return ITEMS.find(
			(spec) =>
				spec.type === source.type &&
				spec.name === name &&
				(spec.class === undefined || spec.class === source.system?.class),
		);
	}
}

export { Migration054MageShepherdPilot };
