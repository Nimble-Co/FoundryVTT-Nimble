import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };

const CLASS_SOURCE_ID = 'Compendium.nimble.nimble-classes.Item.xfwQiIupABgyzq3o';
const CLASS_IDENTIFIER = 'shadowmancer';

/** The spell cost declaration the pack now ships on the Shadowmancer class. */
const CLASS_SPELLCASTING = {
	castAtHighestTier: true,
	cost: {
		poolIdentifier: 'pilfered-power',
		amount: '1',
		overdraftConsequence: 'halfMaxHpDamage',
		// Greedy Pact replaces the fixed penalty from level 12, and that rule is
		// not automated, so the penalty stops applying past Shadowmancer level 11.
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
				// Not `onInitiativeRolled`, which the rules text names: it fires on
				// every roll with no dedup, so a re-roll would hand out a second use.
				// `encounterStart` fires once per combat. The end-of-combat expiry of
				// an unused grant is not expressible.
				addRefills: [{ trigger: 'encounterStart', mode: 'add', value: '1', predicate: {} }],
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
 * and Heart of Burning Fire gains its combat-start use recovery. No stored
 * resource state moves; the pool seeds itself from its `initial` mode.
 *
 * Matches on compendium source id, falling back to class + item name for
 * copies without one. Appends only, and idempotent across repeat runs: a rule
 * carrying the same id is never added twice, and the class declaration is
 * only written when the pool identifier is not already set.
 */
class Migration052ShadowmancerPilferedPower extends MigrationBase {
	static override readonly version = 52;

	override readonly version = Migration052ShadowmancerPilferedPower.version;

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
		if (!classes.every((item: any) => this.#isShadowmancerClass(item))) return;

		const mana = source.system?.resources?.mana;
		if (!(mana?.current > 0)) return;

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

	/**
	 * A class copied into a world can lose its compendium source id, and its
	 * identifier field can be blank. The name is read in that case only, the
	 * same fallback the item's `identifier` getter makes.
	 */
	#isShadowmancerClass(source: any): boolean {
		if (toSnapshotId(this.getSourceId(source)) === CLASS_SOURCE_ID) return true;

		const identifier = source.system?.identifier ?? '';
		if (identifier.length > 0) return identifier === CLASS_IDENTIFIER;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return name === CLASS_IDENTIFIER;
	}

	#updateClass(source: any): void {
		if (!this.#isShadowmancerClass(source)) return;

		const system = (source.system ??= {} as Record<string, unknown>);
		const alreadyDeclared =
			typeof system.spellcasting?.cost?.poolIdentifier === 'string' &&
			system.spellcasting.cost.poolIdentifier.length > 0;
		if (alreadyDeclared) return;

		system.mana = { ...(system.mana ?? {}), formula: '' };
		system.spellcasting = foundry.utils.deepClone(CLASS_SPELLCASTING);
		console.log('Nimble Migration | Shadowmancer class: declared Pilfered Power spell cost');
	}

	/**
	 * Brings the item's rules up to what the pack now ships. A rule the item does
	 * not have is added. A rule it already has keeps every value it holds and
	 * gains only the keys it never had, so an item carrying an earlier version of
	 * a rule picks up fields added since without losing an edit made to it.
	 */
	#appendRules(source: any, rules: RuleSource[]): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const existing: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);

		let changed = false;
		for (const rule of rules) {
			const id = ruleId(rule);
			const current = existing.find((candidate) => ruleId(candidate) === id);

			if (!current) {
				existing.push(foundry.utils.deepClone(rule));
				changed = true;
				continue;
			}

			for (const [key, value] of Object.entries(rule)) {
				if (key in (current as Record<string, unknown>)) continue;
				(current as Record<string, unknown>)[key] = foundry.utils.deepClone(value);
				changed = true;
			}
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

export { Migration052ShadowmancerPilferedPower };
