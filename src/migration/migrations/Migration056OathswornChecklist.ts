import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const CLASS_IDENTIFIER = 'oathsworn';

const OATH_OF_VENGEANCE_SOURCE_ID = 'Compendium.nimble.nimble-subclasses.Item.fckNYu70sPhp2Kv9';
const OATH_OF_VENGEANCE_NAME = 'oath of vengeance';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };

/** Rules the pack now ships on Paragon of Virtue, ids included. */
const PARAGON_OF_VIRTUE_RULES: RuleSource[] = [
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'KVe65ndJ6XU7BU8u',
		identifier: '',
		label: 'Forthrightly telling the truth',
		predicate: {},
		priority: 1,
		value: 1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['influence'],
	},
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'J7Fuc9p4b5DK318m',
		identifier: '',
		label: 'Misleading',
		predicate: {},
		priority: 1,
		value: -1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['influence'],
	},
];

const MY_LIFE_FOR_MY_FRIENDS_RULES: RuleSource[] = [
	{
		type: 'actionCost',
		disabled: false,
		id: 'o4qFJ7V9yf2E7Qrl',
		identifier: '',
		label: 'My Life, for My Friends',
		predicate: {},
		priority: 1,
		suppressActivationCard: 'auto',
		applies: 'heroicReaction',
		mode: 'set',
		value: '0',
		itemTypes: [],
		itemIdentifier: '',
		reactions: ['interpose'],
	},
];

const MASTER_OF_RADIANCE_RULES: RuleSource[] = [
	{
		id: 'master-radiance-radiant-l7',
		type: 'grantSpells',
		schools: ['radiant'],
		tiers: [0],
		mode: 'selectSpell',
		count: 1,
		utilityOnly: true,
		label: 'Master of Radiance: Radiant Utility Spell',
		predicate: { level: { min: 7 } },
	},
	{
		id: 'master-radiance-radiant-l11',
		type: 'grantSpells',
		schools: ['radiant'],
		tiers: [0],
		mode: 'selectSpell',
		count: 1,
		utilityOnly: true,
		label: 'Master of Radiance (2): Radiant Utility Spell',
		predicate: { level: { min: 11 } },
	},
];

const MASTER_OF_RADIANCE_OLD_DESCRIPTION =
	'<p>Choose 1 Radiant Utility Spell.</p><hr><p>Level 11: Choose a 2nd Radiant Utility Spell</p>';
const MASTER_OF_RADIANCE_DESCRIPTION =
	'<p>Choose 1 Radiant Utility Spell.</p><hr><p>Level 11: Choose a 2nd Radiant Utility Spell.</p>';

const SACRED_DECREE_DESCRIPTION =
	'<p>Learn 1 Sacred Decree.</p><hr><p>Level 6: Learn a 2nd Sacred Decree.</p><p>Level 9: Learn a 3rd Sacred Decree.</p><p>Level 12: Learn a 4th Sacred Decree.</p><p>Level 14: Learn a 5th Sacred Decree.</p><p>Level 16: Learn a 6th Sacred Decree.</p>';

const LAY_ON_HANDS_OLD_DESCRIPTION =
	"<p>Gain a magical pool of healing power. This pool's maximum is always equal to 5×LVL and recharges on a Safe Rest. Action: Touch a target and spend any amount of remaining healing power to restore that many HP.</p><p><em>Click this feature to use it. Choose how much healing power to spend; the target is healed for that much. The pool refreshes on a Safe Rest.</em></p>";
const LAY_ON_HANDS_DESCRIPTION =
	"<p>Gain a magical pool of healing power. This pool's maximum is always equal to 5×LVL and recharges on a Safe Rest. Action: Touch a target and spend any amount of remaining healing power to restore that many HP.</p>";

const OATH_OF_VENGEANCE_OLD_DESCRIPTION =
	'<p>LEVEL 3 </p><p><strong>Aura of Zeal.</strong> Whenever you roll Judgment Dice, roll 1 more. Gain an aura with a Reach of 4. Your Radiant Judgment also triggers when an ally within your aura is attacked while you have no Judgment Dice.</p><p>LEVEL 7 </p><p><strong>Avenger.</strong> Whenever you or an ally within your aura gain any Wounds, change up to that many Judgment Dice to their max. Then, move up to half your speed for free.</p><p><strong>LEVEL 11</strong> </p><p><strong>Unerring Judgment.</strong> Increase your primary die rolls on melee attacks by 1 whenever you you have Judgment Dice.</p><p>LEVEL 15 </p><p><strong>Maximum Judgment.</strong> Whenever you are attacked, set a Judgment Die to its max.</p>';
const OATH_OF_VENGEANCE_DESCRIPTION =
	'<p>LEVEL 3 </p><p><strong>Aura of Zeal.</strong> Whenever you roll Judgment Dice, roll 1 more. Gain an aura with a Reach of 4. Your Radiant Judgment also triggers when an ally within your aura is attacked while you have no Judgment Dice.</p><p>LEVEL 7 </p><p><strong>Avenger.</strong> Whenever you or an ally within your aura gain any Wounds, change up to that many Judgment Dice to their max. Then, move up to half your speed for free.</p><p><strong>LEVEL 11</strong> </p><p><strong>Unerring Judgment.</strong> Increase your primary die rolls on melee attacks by 1 whenever you have Judgment Dice.</p><p>LEVEL 15 </p><p><strong>Maximum Judgment.</strong> Whenever you are attacked, set a Judgment Die to its max.</p>';

function sign(value: unknown): number {
	return typeof value === 'number' ? Math.sign(value) : Number.NaN;
}

function includes(value: unknown, member: string): boolean {
	return Array.isArray(value) && value.includes(member);
}

function levelGate(rule: RuleSource): unknown {
	return (rule.predicate as { level?: { min?: unknown } } | undefined)?.level?.min;
}

/** A rule already covering the same clause, whatever id it carries. */
type Equivalence = (existing: RuleSource, wanted: RuleSource) => boolean;

interface FeatureSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	rules?: RuleSource[];
	sameClause?: Equivalence;
	description?: { from: string; to: string };
	/** Switches the activation cost away from an action, while it is still one. */
	costBecomesNone?: boolean;
}

const FEATURES: FeatureSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}TIiGVGorAAIwq6sV`,
		name: 'paragon of virtue',
		rules: PARAGON_OF_VIRTUE_RULES,
		// Influence is one skill with two opposed clauses, so the sign tells them
		// apart: a GM's own penalty for lying stands in for the pack's.
		sameClause: (existing, wanted) =>
			existing.type === 'situationalRollMode' &&
			existing.checkType === 'skillCheck' &&
			includes(existing.skills, 'influence') &&
			sign(existing.value) === sign(wanted.value),
	},
	{
		sourceId: `${FEATURE_PREFIX}9FM9njluCPi9ccvo`,
		name: 'my life, for my friends',
		rules: MY_LIFE_FOR_MY_FRIENDS_RULES,
		sameClause: (existing) =>
			existing.type === 'actionCost' &&
			existing.applies === 'heroicReaction' &&
			includes(existing.reactions, 'interpose'),
	},
	{
		sourceId: `${FEATURE_PREFIX}3WWbCoU7dHAfaDNy`,
		name: 'master of radiance',
		rules: MASTER_OF_RADIANCE_RULES,
		sameClause: (existing, wanted) =>
			existing.type === 'grantSpells' &&
			existing.mode === 'selectSpell' &&
			includes(existing.schools, 'radiant') &&
			levelGate(existing) === levelGate(wanted),
		description: {
			from: MASTER_OF_RADIANCE_OLD_DESCRIPTION,
			to: MASTER_OF_RADIANCE_DESCRIPTION,
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}So6ET6oQ6cEBQaji`,
		name: 'sacred decree',
		description: { from: '', to: SACRED_DECREE_DESCRIPTION },
	},
	{
		sourceId: `${FEATURE_PREFIX}Ddm1A7P01CcmPrim`,
		name: 'lay on hands',
		description: { from: LAY_ON_HANDS_OLD_DESCRIPTION, to: LAY_ON_HANDS_DESCRIPTION },
	},
	{
		sourceId: `${FEATURE_PREFIX}KqEsj4GVzZOPzEgu`,
		name: 'shining mandate',
		costBecomesNone: true,
	},
	{
		sourceId: `${FEATURE_PREFIX}FMjduvyBUYacoRQz`,
		name: 'well armored',
		costBecomesNone: true,
	},
];

/**
 * Brings existing Oathsworn features up to what the pack now ships (the
 * Oathsworn checklist pass).
 *
 * Paragon of Virtue, My Life, for My Friends and Master of Radiance gain the
 * rules that were missing, Sacred Decree gains the description it never had,
 * Lay on Hands drops the how-to paragraph, Well Armored and Shining Mandate
 * stop costing an action, and Oath of Vengeance loses a doubled word.
 *
 * Matches on compendium source id, falling back to the Oathsworn class plus the
 * feature name for a copy stripped of one. Every write is guarded on the value a
 * player never touched still being there, so a GM's own rule, description or cost
 * survives, and a second run changes nothing.
 */
class Migration056OathswornChecklist extends MigrationBase {
	static override readonly version = 56;

	override readonly version = Migration056OathswornChecklist.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type === 'subclass') {
			this.#fixOathOfVengeance(source);
			return;
		}
		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec || !source.system) return;

		const changed = [
			this.#addRules(source, spec),
			this.#setDescription(source, spec),
			this.#dropActionCost(source, spec),
		].some(Boolean);
		if (!changed) return;

		console.log(
			`Nimble Migration | ${source.name ?? spec.sourceId}: updated for the Oathsworn pass`,
		);
	}

	/**
	 * A compendium id names the item outright, so a feature from another pack that
	 * shares a name is left alone. Anything else reads the class and the name, the
	 * pair a world copy keeps.
	 */
	#matchFeature(source: any): FeatureSpec | undefined {
		const sourceId = toSnapshotId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return FEATURES.find((feature) => feature.sourceId === sourceId);
		}

		if (source.system?.class !== CLASS_IDENTIFIER) return undefined;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return FEATURES.find((feature) => feature.name === name);
	}

	/**
	 * Adds a rule the pack ships unless the item already carries it by id, or
	 * carries one covering the same clause under an id of its own. A GM who
	 * automated the feature by hand keeps their version, and every other rule on
	 * the item is left where it is.
	 */
	#addRules(source: any, spec: FeatureSpec): boolean {
		if (!spec.rules || !spec.sameClause) return false;

		const system = source.system;
		const existing: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);

		let changed = false;
		for (const wanted of spec.rules) {
			const covered = existing.some(
				(rule) => rule?.id === wanted.id || spec.sameClause?.(rule ?? {}, wanted),
			);
			if (covered) continue;

			existing.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	/** Only while the stored text is the one the pack used to ship. */
	#setDescription(source: any, spec: FeatureSpec): boolean {
		if (!spec.description) return false;
		if ((source.system.description ?? '') !== spec.description.from) return false;

		source.system.description = spec.description.to;
		return true;
	}

	#dropActionCost(source: any, spec: FeatureSpec): boolean {
		if (!spec.costBecomesNone) return false;

		const cost = source.system.activation?.cost;
		if (cost?.type !== 'action') return false;

		cost.type = 'none';
		return true;
	}

	#fixOathOfVengeance(source: any): void {
		const sourceId = toSnapshotId(this.getSourceId(source));
		const matches = sourceId?.startsWith(COMPENDIUM_PREFIX)
			? sourceId === OATH_OF_VENGEANCE_SOURCE_ID
			: source.system?.parentClass === CLASS_IDENTIFIER &&
				typeof source.name === 'string' &&
				source.name.trim().toLowerCase() === OATH_OF_VENGEANCE_NAME;
		if (!matches) return;
		if (source.system?.description !== OATH_OF_VENGEANCE_OLD_DESCRIPTION) return;

		source.system.description = OATH_OF_VENGEANCE_DESCRIPTION;
		console.log(`Nimble Migration | ${source.name}: fixed the Unerring Judgment wording`);
	}
}

export { Migration056OathswornChecklist };
