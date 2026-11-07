import { isCompendiumId, SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };
type RecoverySource = Record<string, unknown>;

/** A use pool that refilled only on the owner's turn: it now refills on each creature's turn. */
interface EachTurnPool {
	kind: 'eachTurn';
	poolRuleId: string;
}

/** A use pool that a Change a Die rule spent: the pool goes, and the rule gets `to`. */
interface DroppedPool {
	kind: 'dropPool';
	poolRuleId: string;
	poolIdentifier: string;
	changeDieRuleId: string;
	to: Record<string, unknown>;
}

interface PackItemSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	classIdentifier: string;
	change: EachTurnPool | DroppedPool;
}

const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}m2UtBsxfiXhKRLYD`,
		name: 'blood frenzy',
		classIdentifier: 'berserker',
		change: { kind: 'eachTurn', poolRuleId: 'blood-frenzy-use-pool' },
	},
	{
		sourceId: `${FEATURE_PREFIX}TlypDcFgcmWK8Vpu`,
		name: 'deathless rage',
		classIdentifier: 'berserker',
		change: { kind: 'eachTurn', poolRuleId: 'deathless-rage-use-pool' },
	},
	{
		sourceId: `${FEATURE_PREFIX}uvP5qvxMonL4ZOw2`,
		name: 'taunting strike',
		classIdentifier: 'commander',
		change: { kind: 'eachTurn', poolRuleId: 'taunting-strike-use-pool' },
	},
	{
		sourceId: `${FEATURE_PREFIX}kHjJhTZEQcdbUMbb`,
		name: 'vicious opportunist',
		classIdentifier: 'the-cheat',
		change: {
			kind: 'dropPool',
			poolRuleId: 'rx3oOrQaWNVWae4a',
			poolIdentifier: 'vicious-opportunist',
			changeDieRuleId: 'fSZR3ZQdBfmyLG3n',
			to: { chargePoolIdentifier: '', oncePerTurn: true },
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}BKQ0hIqBvjSpS1xR`,
		name: 'feinting attack',
		classIdentifier: 'the-cheat',
		change: {
			kind: 'dropPool',
			poolRuleId: 'ss6MY4JTCKmO4MjC',
			poolIdentifier: 'feinting-attack',
			changeDieRuleId: 'hD0YqPJG3dHETk9y',
			to: { chargePoolIdentifier: '' },
		},
	},
];

const EACH_TURN_RECOVERIES = [
	{ trigger: 'onAnyTurnStart', mode: 'refresh', value: '1' },
	{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
];

/** The document id of a copy from any pack of this system, also an older pack name. */
function packDocumentId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (!snapshotId?.startsWith(SNAPSHOT_PREFIX)) return undefined;
	const match = /\.Item\.([^.]+)$/.exec(snapshotId);
	return match?.[1];
}

/** A missing field reads as its blank value: false, '' and absent are the same. */
function stored(value: unknown): unknown {
	return value === undefined || value === '' || value === false ? null : value;
}

function isRefreshOnTurnStart(entry: RecoverySource): boolean {
	return (
		entry?.trigger === 'onTurnStart' &&
		entry.mode === 'refresh' &&
		String(entry.value) === '1' &&
		stored(entry.temporary) === null &&
		stored(entry.notWhenSpent) === null &&
		stored(entry.needsFeatureEffects) === null
	);
}

function isEncounterEndRefresh(entry: RecoverySource): boolean {
	return entry?.trigger === 'encounterEnd' && entry.mode === 'refresh';
}

/** The pool refills only on the owner's turn start, and maybe at the end of the encounter. */
function hasOldRecoveries(pool: RuleSource | undefined): boolean {
	const recoveries = pool?.recoveries;
	if (pool?.type !== 'chargePool' || !Array.isArray(recoveries)) return false;
	const turnStarts = recoveries.filter((entry: RecoverySource) => isRefreshOnTurnStart(entry));
	const others = recoveries.filter(
		(entry: RecoverySource) => !isRefreshOnTurnStart(entry) && !isEncounterEndRefresh(entry),
	);
	return turnStarts.length === 1 && others.length === 0;
}

/**
 * Gives copies of five 1/turn pack items what the pack now ships. Blood
 * Frenzy, Deathless Rage and Taunting Strike refill their use at the start of
 * each creature's turn and at the end of the encounter. Vicious Opportunist
 * loses its use pool and uses the 1/turn field of its Change a Die rule.
 * Feinting Attack loses its 1/round pool, which the book does not give it.
 *
 * An item changes only while its rules still hold the old pack values: the
 * pool refills only on the owner's turn start, and for a dropped pool the
 * Change a Die rule still spends it. Matched on compendium source id (the
 * document id, so an older pack name also matches), falling back to the class
 * and the name for a copy stripped of one. A second run changes nothing.
 */
class Migration081OncePerTurnUses extends MigrationBase {
	static override readonly version = 81;

	override readonly version = Migration081OncePerTurnUses.version;

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature') return;
		const rules = source.system?.rules;
		if (!Array.isArray(rules)) return;

		const spec = this.#match(source);
		if (!spec) return;

		const changed =
			spec.change.kind === 'eachTurn'
				? this.#refillEachTurn(rules, spec.change)
				: this.#dropPool(rules, spec.change);
		if (changed) console.log(`Nimble Migration | ${source.name}: 1/turn on any turn`);
	}

	#refillEachTurn(rules: RuleSource[], change: EachTurnPool): boolean {
		const pool = rules.find((rule) => rule?.id === change.poolRuleId);
		if (!pool || !hasOldRecoveries(pool)) return false;
		pool.recoveries = foundry.utils.deepClone(EACH_TURN_RECOVERIES);
		return true;
	}

	#dropPool(rules: RuleSource[], change: DroppedPool): boolean {
		const poolIndex = rules.findIndex((rule) => rule?.id === change.poolRuleId);
		const pool = rules[poolIndex];
		const changeDie = rules.find((rule) => rule?.id === change.changeDieRuleId);
		if (!pool || !hasOldRecoveries(pool) || pool.identifier !== change.poolIdentifier) return false;
		if (changeDie?.type !== 'changeDie') return false;
		if (changeDie.chargePoolIdentifier !== change.poolIdentifier) return false;

		rules.splice(poolIndex, 1);
		Object.assign(changeDie, change.to);
		return true;
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = this.getSourceId(source);
		const documentId = packDocumentId(sourceId);
		if (documentId) {
			return PACK_ITEMS.find((spec) => spec.sourceId.endsWith(`.Item.${documentId}`));
		}
		if (isCompendiumId(sourceId)) return undefined;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) => spec.name === name && spec.classIdentifier === source.system.class,
		);
	}
}

export { Migration081OncePerTurnUses };
