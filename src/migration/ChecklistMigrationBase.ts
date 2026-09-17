import { toSnapshotId } from './compendiumSourceId.js';
import { MigrationBase } from './MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';

/** Where every class feature the checklist passes touch lives. */
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';

/** The same pack under the name it carried before the rename, still stored on old copies. */
const LEGACY_FEATURE_PREFIX = 'Compendium.nimble.class-features.Item.';

function toFeatureSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	return snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)
		? `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`
		: snapshotId;
}

type RuleSource = Record<string, unknown> & { type?: unknown; id?: unknown };
type EffectSource = Record<string, unknown> & { id?: unknown; type?: unknown };

interface FeatureSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	/** The class a copy that lost its compendium id must belong to, when not the migration's own. */
	classIdentifier?: string;
	rules?: RuleSource[];
	/** Added only while the item carries no effect of its own. */
	effects?: EffectSource[];
	description?: { from: string; to: string };
}

/**
 * Whether the targets one rule reads take in every target another reads. The
 * `all` sentinel covers everything and is covered by nothing narrower.
 */
function coversSkills(existing: unknown, wanted: unknown): boolean {
	if (!Array.isArray(existing) || !Array.isArray(wanted) || wanted.length === 0) return false;
	if (existing.includes('all')) return true;
	return wanted.every((skill) => skill !== 'all' && existing.includes(skill));
}

/** The list a situational roll mode reads for each kind of check it can bend. */
const SITUATIONAL_TARGETS: Record<string, 'skills' | 'saves' | 'abilities'> = {
	skillCheck: 'skills',
	savingThrow: 'saves',
	abilityCheck: 'abilities',
};

/** An empty damage type list is every damage type. */
function coversDamageTypes(existing: unknown, wanted: unknown): boolean {
	if (!Array.isArray(existing) || !Array.isArray(wanted)) return false;
	if (existing.length === 0) return true;
	return wanted.length > 0 && wanted.every((type) => existing.includes(type));
}

function sign(value: unknown): number {
	return typeof value === 'number' ? Math.sign(value) : Number.NaN;
}

/**
 * A rule already covering the same clause, whatever id it carries: a pool is
 * keyed by what it holds, a consumer by the pool it spends, an action by who
 * gains it, a roll mode by the skills it reads and the direction it bends, a
 * damage reduction by its mode and the damage types it covers, and an unarmed
 * damage formula by its type alone, as the last one to run sets the value.
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
		case 'unarmedDamage':
			return true;
		case 'damageReduction':
			return (
				existing.mode === wanted.mode && coversDamageTypes(existing.damageTypes, wanted.damageTypes)
			);
		case 'situationalRollMode': {
			if (existing.checkType !== wanted.checkType) return false;
			const targets = SITUATIONAL_TARGETS[String(wanted.checkType)];
			const covered = targets
				? coversSkills(existing[targets], wanted[targets])
				: wanted.checkType === 'initiative';
			return covered && sign(existing.value) === sign(wanted.value);
		}
		case 'skillRollMode':
			return (
				existing.mode === wanted.mode &&
				coversSkills(existing.skills, wanted.skills) &&
				sign(existing.value) === sign(wanted.value)
			);
		default:
			return false;
	}
}

/**
 * Brings the existing copies of a class's features up to what the pack ships
 * after a checklist pass. A subclass names the class, the pass and the features.
 *
 * Matches on compendium source id, falling back to the class plus the feature
 * name for a copy stripped of one. Every write is guarded on the value a player
 * never touched still being there, so a GM's own rule, effect or description
 * survives, and a second run changes nothing.
 */
abstract class ChecklistMigrationBase extends MigrationBase {
	/** The `system.class` identifier a world copy keeps. */
	protected abstract readonly classIdentifier: string;

	/** Names the pass in the console line, as in `the Cheat pass`. */
	protected abstract readonly passName: string;

	protected abstract readonly features: FeatureSpec[];

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature') return;

		const spec = this.#matchFeature(source);
		if (!spec || !source.system) return;

		const changed = [
			this.#addRules(source, spec),
			this.#addEffects(source, spec),
			this.#setDescription(source, spec),
		].some(Boolean);
		if (!changed) return;

		console.log(`Nimble Migration | ${source.name ?? spec.sourceId}: updated for ${this.passName}`);
	}

	/**
	 * A compendium id names the item outright, so a feature from another pack that
	 * shares a name is left alone. Anything else reads the class and the name, the
	 * pair a world copy keeps.
	 */
	#matchFeature(source: any): FeatureSpec | undefined {
		const sourceId = toFeatureSourceId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) {
			return this.features.find((feature) => feature.sourceId === sourceId);
		}

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return this.features.find(
			(feature) =>
				feature.name === name &&
				source.system?.class === (feature.classIdentifier ?? this.classIdentifier),
		);
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
		if (system.rules == null) system.rules = [];
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

	/** Only while the stored text is the one the pack used to ship. */
	#setDescription(source: any, spec: FeatureSpec): boolean {
		if (!spec.description) return false;
		if ((source.system.description ?? '') !== spec.description.from) return false;

		source.system.description = spec.description.to;
		return true;
	}
}

export { ChecklistMigrationBase, FEATURE_PREFIX };
export type { EffectSource, FeatureSpec, RuleSource };
