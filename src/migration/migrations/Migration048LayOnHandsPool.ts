import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';

const LAY_ON_HANDS_SOURCE_ID = 'Compendium.nimble.nimble-class-features.Item.Ddm1A7P01CcmPrim';
const LAY_ON_HANDS_NAME = 'Lay on Hands';

// The flat formula the healing node carried before the pool existed.
const SUPERSEDED_FORMULAS = new Set(['5*@level', '5 * @level']);

/** Rule ids match the pack, so a migrated copy is identical to a fresh drag. */
const POOL_RULE = {
	type: 'chargePool',
	disabled: false,
	id: 'lay-on-hands-pool',
	identifier: 'lay-on-hands',
	label: 'Lay on Hands',
	predicate: {},
	priority: 1,
	scope: 'item',
	max: '5 * @level',
	dieSize: null,
	initial: 'max',
	hidden: false,
	recoveries: [
		{
			trigger: 'safeRest',
			mode: 'refresh',
			value: '1',
		},
	],
};

const CONSUMER_RULE = {
	type: 'chargeConsumer',
	disabled: false,
	id: 'lay-on-hands-consumer',
	identifier: '',
	label: '',
	predicate: {},
	priority: 2,
	poolIdentifier: 'lay-on-hands',
	poolScope: 'item',
	costMode: 'variable',
	cost: '1',
	maxCost: '',
};

/**
 * Turns embedded copies of Lay on Hands into the tracked healing pool the pack
 * now ships (issue #632).
 *
 * The feature used to heal a flat 5×LVL on every use, with nothing tracking the
 * pool it is supposed to spend from. It now carries a charge pool that refills
 * on a Safe Rest and a variable consumer, so the activation asks how much to
 * spend and heals that much.
 *
 * Matches on compendium source id, falling back to the feature name for copies
 * a duplicated world compendium stripped it from. Idempotent, and conservative
 * about a GM's own work: the rules are appended only when nothing already
 * targets the pool, and the healing formula is rewritten only while it is still
 * the superseded flat one.
 */
class Migration048LayOnHandsPool extends MigrationBase {
	static override readonly version = 48;

	override readonly version = Migration048LayOnHandsPool.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;

		const sourceId = toSnapshotId(this.getSourceId(source));
		const isLayOnHands = sourceId?.startsWith(COMPENDIUM_PREFIX)
			? sourceId === LAY_ON_HANDS_SOURCE_ID
			: source.name === LAY_ON_HANDS_NAME;
		if (!isLayOnHands) return;

		const changed = this.#addPoolRules(source);
		if (!changed) return;

		this.#pointHealingAtTheSpend(source);

		// The spend amount is collected in the activation dialog, so a copy that
		// suppressed the dialog would have no way to name one.
		const activation = (source.system.activation ??= {} as Record<string, unknown>);
		activation.skipRollDialog = false;

		console.log(`Nimble Migration | ${source.name}: added the Lay on Hands healing pool`);
	}

	/** Appends the pool and its consumer unless something already covers them. */
	#addPoolRules(source: any): boolean {
		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: Array<Record<string, unknown>> = Array.isArray(system.rules)
			? system.rules
			: (system.rules = []);

		const hasPool = rules.some((rule) => rule?.type === 'chargePool');
		const hasConsumer = rules.some((rule) => rule?.type === 'chargeConsumer');
		if (hasPool || hasConsumer) return false;

		rules.push(foundry.utils.deepClone(POOL_RULE), foundry.utils.deepClone(CONSUMER_RULE));
		return true;
	}

	/**
	 * Repoints the healing node at the amount spent. A copy whose formula a GM
	 * has already changed is left alone: their number is a deliberate one, and
	 * overwriting it would silently replace their homebrew.
	 */
	#pointHealingAtTheSpend(source: any): void {
		const effects = source.system?.activation?.effects;
		if (!Array.isArray(effects)) return;

		for (const effect of effects) {
			if (effect?.type !== 'healing') continue;
			if (!SUPERSEDED_FORMULAS.has(effect.formula)) continue;
			effect.formula = '@spent';
		}
	}
}

export { Migration048LayOnHandsPool };
