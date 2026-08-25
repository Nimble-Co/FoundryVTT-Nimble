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
				// The rules text is "each time you roll Initiative", so the refill is tied
				// to the initiative roll rather than to the start of the encounter. A second
				// roll therefore grants a second use, which the pool maximum still bounds.
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
