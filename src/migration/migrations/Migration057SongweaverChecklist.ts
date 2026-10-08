import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';
const CLASS_IDENTIFIER = 'songweaver';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };
type EffectSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface CostSource {
	details: string;
	quantity: number;
	type: string;
	isReaction: boolean;
}

/** Rules the pack now ships on Linos, the Everfriendly, ids included. */
const LINOS_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'eHJc9uFX6uiWsM7z',
		identifier: 'linos-uses',
		label: 'Linos (1/Safe Rest)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'acurRMnFK0TGuvzF',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'linos-uses',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
];

const MAL_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'AAZ7pMGQy4wSDIQW',
		identifier: 'mal-uses',
		label: 'Mal (1/Safe Rest)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'DpIuFeV1iLXTys6b',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'mal-uses',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
	{
		type: 'situationalRollMode',
		disabled: false,
		id: 'wpfu7QzwM3ZOYTvB',
		identifier: '',
		label: 'Asking Mal for something mischievous or fun',
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
		id: 'GfWNqmSyh3ljqYGQ',
		identifier: '',
		label: 'Asking Mal for something good or menial',
		predicate: {},
		priority: 1,
		value: -1,
		checkType: 'skillCheck',
		saves: [],
		abilities: [],
		skills: ['influence'],
	},
];

const STOMPY_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'ywF1Arf2sHg8iSQA',
		identifier: 'stompy-uses',
		label: 'Stompy (1/Safe Rest)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'z7UTyZyGHXovo6nA',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'stompy-uses',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
];

const GRAN_GRAN_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: '2VLypaGH3xEXkYTI',
		identifier: 'gran-gran-uses',
		label: 'Gran Gran (1/Safe Rest)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'UrDqSXux3xGu1DGc',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'gran-gran-uses',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
];

const INSPIRING_ANTHEM_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'inspiring-anthem-encounter-pool',
		identifier: 'inspiring-anthem-encounter',
		label: 'Inspiring Anthem (1/encounter)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'inspiring-anthem-encounter-consumer',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'inspiring-anthem-encounter',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
	{
		type: 'actionDelta',
		disabled: false,
		id: 'inspiring-anthem-action',
		identifier: '',
		label: 'Inspiring Anthem',
		predicate: {},
		priority: 3,
		value: '1',
		timing: 'now',
		target: 'targeted',
		borrowFromNextTurn: false,
	},
];

/** The heal and the reminder the anthem never carried. */
const INSPIRING_ANTHEM_EFFECTS: EffectSource[] = [
	{
		id: '9szVrtMDOk3M8eff',
		type: 'healing',
		healingType: 'healing',
		formula: '1',
		targetDisposition: 'friendly',
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'yfLZ0fyJxVRAZekF',
		type: 'note',
		noteType: 'reminder',
		text: 'Target the friendly Dying creatures who can hear you.',
		parentContext: null,
		parentNode: null,
	},
];

const CHORUS_RULES: RuleSource[] = [
	{
		type: 'chargePool',
		disabled: false,
		id: 'rwu9fnvv1Zt3eSqc',
		identifier: 'chorus-of-champions-encounter',
		label: 'Chorus of Champions (1/encounter)',
		predicate: {},
		priority: 1,
		scope: 'item',
		max: '1',
		dieSize: null,
		initial: 'max',
		hidden: false,
		showAsResource: false,
		recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '1' }],
	},
	{
		type: 'chargeConsumer',
		disabled: false,
		id: 'mFyQuRdtkLDdffgh',
		identifier: '',
		label: '',
		predicate: {},
		priority: 2,
		poolIdentifier: 'chorus-of-champions-encounter',
		poolScope: 'item',
		costMode: 'fixed',
		cost: '1',
		maxCost: '',
	},
	{
		type: 'actionDelta',
		disabled: false,
		id: 'oVuhOT9lfMaJyHTq',
		identifier: '',
		label: 'Chorus of Champions',
		predicate: {},
		priority: 3,
		value: '1',
		timing: 'now',
		target: 'allAllies',
		borrowFromNextTurn: false,
	},
	{
		type: 'actionDelta',
		disabled: false,
		id: 'o0rWADa7dscg4q66',
		identifier: '',
		label: 'Chorus of Champions',
		predicate: {},
		priority: 3,
		value: '1',
		timing: 'now',
		target: 'self',
		borrowFromNextTurn: false,
	},
];

/** A summon costs nothing on its own, the friend brought along the old 3. */
const SUMMON_OLD_COST: CostSource = {
	details: '',
	quantity: 3,
	type: 'none',
	isReaction: false,
};

const SUMMON_COST: CostSource = {
	details: '',
	quantity: 1,
	type: 'none',
	isReaction: false,
};

/** The reaction wording five progression entries carried without being reactions. */
const ALLY_ROLL_COST: CostSource = {
	details: 'An ally makes a roll',
	quantity: 1,
	type: 'none',
	isReaction: true,
};

const PASSIVE_COST: CostSource = {
	details: '',
	quantity: 1,
	type: 'none',
	isReaction: false,
};

const SNARK_OLD_COST: CostSource = {
	details: 'when an enemy within Range 12 misses an attack',
	quantity: 1,
	type: 'none',
	isReaction: true,
};

const SNARK_COST: CostSource = {
	details: 'when an enemy within Range 12 misses an attack',
	quantity: 1,
	type: 'action',
	isReaction: true,
};

const INSPIRATION_COST: CostSource = {
	details: 'An ally makes a roll',
	quantity: 0,
	type: 'action',
	isReaction: true,
};

const CHORUS_OLD_COST: CostSource = {
	details: '',
	quantity: 1,
	type: 'none',
	isReaction: false,
};

const CHORUS_COST: CostSource = {
	details: '',
	quantity: 0,
	type: 'action',
	isReaction: true,
};

const A_PEOPLE_PERSON_DESCRIPTION =
	"<p>You've met many people in your travels; some have even agreed to come to your aid should you need it. Choose 2 friends you know: you can temporarily summon them via song (1/Safe Rest each).</p>";

const LYRICAL_WEAPONRY_DESCRIPTION =
	'<p>Choose 1 ability from the Lyrical Weaponry list.</p><hr><p>Level 9: Choose a 2nd ability from the Lyrical Weaponry list.</p><p>Level 13: Choose a 3rd ability from the Lyrical Weaponry list.</p><p>Level 17: Choose a 4th ability from the Lyrical Weaponry list.</p>';

function includesAny(value: unknown, members: unknown): boolean {
	if (!Array.isArray(value) || !Array.isArray(members)) return false;
	return members.some((member) => value.includes(member));
}

function sign(value: unknown): number {
	return typeof value === 'number' ? Math.sign(value) : Number.NaN;
}

/**
 * A rule already covering the same clause, whatever id it carries: a pool is
 * keyed by what it holds, a consumer by the pool it spends, an action by who
 * gains it, and a roll mode by the skill and the direction it bends.
 */
function coversSameClause(existing: RuleSource, wanted: RuleSource): boolean {
	if (!existing || existing.type !== wanted.type) return false;

	switch (wanted.type) {
		case 'chargePool':
			return existing.identifier === wanted.identifier;
		case 'chargeConsumer':
			return existing.poolIdentifier === wanted.poolIdentifier;
		case 'actionDelta':
			return existing.target === wanted.target;
		case 'situationalRollMode':
			return (
				existing.checkType === 'skillCheck' &&
				includesAny(existing.skills, wanted.skills) &&
				sign(existing.value) === sign(wanted.value)
			);
		default:
			return false;
	}
}

function sameCost(stored: any, wanted: CostSource): boolean {
	return (
		stored?.details === wanted.details &&
		stored?.quantity === wanted.quantity &&
		stored?.type === wanted.type &&
		stored?.isReaction === wanted.isReaction
	);
}

interface FeatureSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	rules?: RuleSource[];
	/** Added only while the item carries no effect of its own. */
	effects?: EffectSource[];
	description?: { from: string; to: string };
	/** The whole cost, replaced only while every field is still the old value. */
	cost?: { from: CostSource; to: CostSource };
}

const FEATURES: FeatureSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}5JmWY65e9EUgvK1y`,
		name: 'linos, the everfriendly',
		rules: LINOS_RULES,
		cost: { from: SUMMON_OLD_COST, to: SUMMON_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}abIU97U8yyMSPj3p`,
		name: 'mal, the malevolent imp',
		rules: MAL_RULES,
		cost: { from: SUMMON_OLD_COST, to: SUMMON_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}sTNB6EgF2FC5KyQZ`,
		name: 'stompy',
		rules: STOMPY_RULES,
	},
	{
		sourceId: `${FEATURE_PREFIX}dlU1fK7RgIyYZQea`,
		name: 'gran gran (not a hag)',
		rules: GRAN_GRAN_RULES,
		cost: { from: SUMMON_OLD_COST, to: SUMMON_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}6MKHrimUWBWolZaX`,
		name: 'opportunistic snark',
		cost: { from: SNARK_OLD_COST, to: SNARK_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}1FeFOFKQevbpIHhu`,
		name: "songweaver's inspiration",
		cost: { from: ALLY_ROLL_COST, to: INSPIRATION_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}TCR6GfMyG3nSRKtY`,
		name: 'inspiring anthem',
		rules: INSPIRING_ANTHEM_RULES,
		effects: INSPIRING_ANTHEM_EFFECTS,
	},
	{
		sourceId: `${FEATURE_PREFIX}YeG09ogHG3RD6tIc`,
		name: 'a people person',
		description: { from: '', to: A_PEOPLE_PERSON_DESCRIPTION },
	},
	{
		sourceId: `${FEATURE_PREFIX}Jc93iQWqr6fUEjHX`,
		name: 'lyrical weaponry',
		description: { from: '', to: LYRICAL_WEAPONRY_DESCRIPTION },
	},
	{
		sourceId: `${FEATURE_PREFIX}idoDoUQuz13FFyJS`,
		name: "i'm so famous!",
		cost: { from: ALLY_ROLL_COST, to: PASSIVE_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}XMMHIW0DsNFGqe1G`,
		name: 'mana and unlock tier 1 spells',
		cost: { from: ALLY_ROLL_COST, to: PASSIVE_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}jBfbkX4fDvOKsoFD`,
		name: 'quick wit',
		cost: { from: ALLY_ROLL_COST, to: PASSIVE_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}Sg4biAyJcsTtWGEr`,
		name: 'song of rest',
		cost: { from: ALLY_ROLL_COST, to: PASSIVE_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}fg1cWHw1YLF2Mcc0`,
		name: 'windbag',
		cost: { from: ALLY_ROLL_COST, to: PASSIVE_COST },
	},
	{
		sourceId: `${FEATURE_PREFIX}ibPEV4fEPpKNF1cY`,
		name: 'chorus of champions',
		rules: CHORUS_RULES,
		cost: { from: CHORUS_OLD_COST, to: CHORUS_COST },
	},
];

/**
 * Brings existing Songweaver features up to what the pack now ships (the
 * Songweaver checklist pass).
 *
 * Linos and Mal gain the uses they spend and stop costing three of anything,
 * Mal also bends Influence both ways, Inspiring Anthem and Chorus of Champions
 * gain their uses and the actions they hand out, A People Person and Lyrical
 * Weaponry gain the description they never had, and five progression entries
 * stop claiming a reaction they never took.
 *
 * Matches on compendium source id, falling back to the Songweaver class plus the
 * feature name for a copy stripped of one. Every write is guarded on the value a
 * player never touched still being there, so a GM's own rule, effect, cost or
 * description survives, and a second run changes nothing.
 */
class Migration057SongweaverChecklist extends MigrationBase {
	static override readonly version = 57;

	override readonly version = Migration057SongweaverChecklist.version;

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec || !source.system) return;

		const changed = [
			this.#addRules(source, spec),
			this.#addEffects(source, spec),
			this.#setCost(source, spec),
			this.#setDescription(source, spec),
		].some(Boolean);
		if (!changed) return;

		console.log(
			`Nimble Migration | ${source.name ?? spec.sourceId}: updated for the Songweaver pass`,
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
		if (!spec.rules) return false;

		const system = source.system;
		if (system.rules === undefined) system.rules = [];
		if (!Array.isArray(system.rules)) return false;
		const existing: RuleSource[] = system.rules;

		let changed = false;
		for (const wanted of spec.rules) {
			const covered = existing.some(
				(rule) => rule?.id === wanted.id || coversSameClause(rule, wanted),
			);
			if (covered) continue;

			existing.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	/** Only while the item carries no effect at all, so a GM's own card stands. */
	#addEffects(source: any, spec: FeatureSpec): boolean {
		if (!spec.effects) return false;

		const effects = source.system.activation?.effects;
		if (!Array.isArray(effects) || effects.length > 0) return false;

		for (const node of spec.effects) effects.push(foundry.utils.deepClone(node));
		return true;
	}

	#setCost(source: any, spec: FeatureSpec): boolean {
		const cost = source.system.activation?.cost;
		if (!cost) return false;

		if (spec.cost && sameCost(cost, spec.cost.from)) {
			Object.assign(cost, spec.cost.to);
			return true;
		}

		return false;
	}

	/** Only while the stored text is the one the pack used to ship. */
	#setDescription(source: any, spec: FeatureSpec): boolean {
		if (!spec.description) return false;
		if ((source.system.description ?? '') !== spec.description.from) return false;

		source.system.description = spec.description.to;
		return true;
	}
}

export { Migration057SongweaverChecklist };
