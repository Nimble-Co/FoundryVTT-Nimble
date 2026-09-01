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

const CLASS_SOURCE_ID = 'Compendium.nimble.nimble-classes.Item.xfwQiIupABgyzq3o';

/** The spell cost declaration the pack now ships on the Shadowmancer class. */
const CLASS_SPELLCASTING = {
	castAtHighestTier: true,
	cost: {
		poolIdentifier: 'pilfered-power',
		amount: '1',
		overdraftConsequence: 'halfMaxHpDamage',
		// Greedy Pact replaces the fixed penalty from level 12, and that rule is
		// not automated, so the penalty stops applying past level 11.
		overdraftMaxLevel: 11,
	},
};

interface FeatureSpec {
	sourceId: string;
	class: string;
	name: string;
	/** Rules the pack now ships, appended when an equivalent is not present. */
	rules: RuleSource[];
}

const FEATURES: FeatureSpec[] = [
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.Af4hwQ1ngzl3ukN3',
		class: 'shadowmancer',
		name: 'pilfered power',
		rules: [
			{
				type: 'chargePool',
				disabled: false,
				id: 'pilfered-power-use-pool',
				identifier: 'pilfered-power',
				label: 'Pilfered Power',
				predicate: {},
				priority: 1,
				scope: 'item',
				max: 'max(@dexterity, 0)',
				dieSize: null,
				initial: 'max',
				showAsResource: true,
				recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
			},
		],
	},
	{
		sourceId: 'Compendium.nimble.nimble-class-features.Item.hGEoVMVk2Wor4fnR',
		class: 'shadowmancer',
		name: 'heart of burning fire',
		rules: [
			{
				type: 'modifyPool',
				disabled: false,
				id: 'heart-of-burning-fire-initiative-regain',
				identifier: '',
				label: 'Heart of Burning Fire: regain 1 use of Pilfered Power on initiative',
				predicate: {},
				priority: 1,
				poolType: 'charge',
				poolIdentifier: 'pilfered-power',
				dieSize: null,
				maxDelta: null,
				// The rules text is "each time you roll Initiative", so the refill is
				// tied to the initiative roll rather than to the start of the encounter.
				// A second roll therefore grants a second use, which the pool maximum
				// still bounds.
				//
				// This differs from Migration041, which chose `encounterStart` for the
				// Commander's equivalent feature to avoid exactly that second grant.
				// Both readings are defensible; this one follows the printed wording,
				// and the clamp at the pool maximum keeps the difference small. The
				// Commander's choice is left as it shipped rather than changed here.
				//
				// Not expressed: the rules end with "This expires at the end of
				// combat if unused". A recovery can add a use but not take back an
				// unspent one, because nothing distinguishes a use granted this
				// combat from one the character already held. The use therefore
				// survives to the next Safe Rest, which is the more generous
				// reading, and the limitation is recorded in the player docs.
				addRefills: [{ trigger: 'onInitiativeRolled', mode: 'add', value: '1', predicate: {} }],
			},
		],
	},
];

function ruleId(rule: RuleSource): string {
	return typeof rule.id === 'string' ? rule.id : '';
}

/**
 * Moves the Shadowmancer from a mislabelled mana pool to Pilfered Power.
 *
 * The class item's mana formula is cleared and replaced with a pool spell
 * cost declaration, the Pilfered Power feature gains its charge pool rule,
 * and Heart of Burning Fire gains its initiative use recovery. No stored
 * resource state moves; the pool seeds itself from its `initial` mode.
 *
 * Matches on compendium source id, falling back to class + item name for
 * copies without one. Appends only, and idempotent across repeat runs: a rule
 * carrying the same id is never added twice, and the class declaration is
 * only written when the pool identifier is not already set.
 */
class Migration048ShadowmancerPilferedPower extends MigrationBase {
	static override readonly version = 48;

	override readonly version = Migration048ShadowmancerPilferedPower.version;

	/**
	 * Clears the mana the Shadowmancer never had.
	 *
	 * The class formula going empty makes the bar disappear, but the stored
	 * current value stays behind. It is invisible while the character has no
	 * other mana source and would resurface the moment they gained one, so it
	 * is cleared here. Only an actor whose classes are all Shadowmancer is
	 * touched, so a multiclass character's real mana is left alone.
	 */
	override async updateActor(source: any): Promise<void> {
		const classes = (source.items ?? []).filter((item: any) => item?.type === 'class');
		if (classes.length < 1) return;
		if (!classes.every((item: any) => item?.system?.identifier === 'shadowmancer')) return;

		const mana = source.system?.resources?.mana;
		if (!mana || mana.current === 0) return;

		mana.current = 0;
		console.log('Nimble Migration | Shadowmancer: cleared mana the class never had');
	}

	override async updateItem(source: any): Promise<void> {
		if (source.type === 'class') {
			this.#updateClass(source);
			return;
		}

		if (source.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec) return;

		if (this.#appendRules(source, spec.rules)) {
			console.log(`Nimble Migration | ${source.name ?? spec.sourceId}: added Pilfered Power rules`);
		}
	}

	#updateClass(source: any): void {
		const sourceId = toSnapshotId(this.getSourceId(source));
		const matchesId = sourceId === CLASS_SOURCE_ID;
		const matchesIdentifier = source.system?.identifier === 'shadowmancer';
		if (!matchesId && !matchesIdentifier) return;

		const system = (source.system ??= {} as Record<string, unknown>);
		const alreadyDeclared =
			typeof system.spellcasting?.cost?.poolIdentifier === 'string' &&
			system.spellcasting.cost.poolIdentifier.length > 0;
		if (alreadyDeclared) return;

		system.mana = { ...(system.mana ?? {}), formula: '' };
		system.spellcasting = foundry.utils.deepClone(CLASS_SPELLCASTING);
		console.log('Nimble Migration | Shadowmancer class: declared Pilfered Power spell cost');
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

export { Migration048ShadowmancerPilferedPower };
