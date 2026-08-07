import { MigrationBase } from '../MigrationBase.js';

/** Namespace the source id below is written under. */
const SNAPSHOT_PREFIX = 'Compendium.nimble.';

/** Every namespace a stored id could carry: the stable id, or the dev rebrand. */
const STORED_PREFIXES = [SNAPSHOT_PREFIX, 'Compendium.nimble-dev.'];

const SURVIVALIST_SOURCE_ID = 'Compendium.nimble.nimble-backgrounds.Item.qKknqLqzT7BReZul';

/**
 * The rule the pack now ships. The id matches the pack entry so a migrated copy
 * behaves identically to a freshly dragged one.
 */
const POISON_SAVE_RULE = {
	type: 'savingThrowRollMode',
	label: 'Survivalist',
	value: 1,
	target: 'all',
	mode: 'adjust',
	situation: 'poison',
	id: '8pUORSgg0CfUHYPc',
} as const;

/**
 * Folds a stored source id onto the namespace the spec uses. `dev-rebrand.mjs`
 * rewrites `packs/**` but not `src/**`, so on the dev build a character's stored
 * id reads `Compendium.nimble-dev.…` and would never match the literal above.
 * The document ids are identical across both installs, so the fold is exact.
 */
function toSnapshotId(packSource: string | undefined): string | undefined {
	if (!packSource) return packSource;
	const prefix = STORED_PREFIXES.find((candidate) => packSource.startsWith(candidate));
	return prefix ? `${SNAPSHOT_PREFIX}${packSource.slice(prefix.length)}` : packSource;
}

/**
 * Backfills the Survivalist background's "Advantage against poison saves" rule,
 * which the pack gained after the background was already draggable.
 *
 * The rule is situational, so it changes no stored value on the actor — it only
 * needs to be present on the embedded item for the saving throw config dialog to
 * list it. Existing rules are left alone, so a hand-authored equivalent is kept
 * and only duplicated if it carries a different id.
 */
class Migration042SurvivalistPoisonSave extends MigrationBase {
	static override readonly version = 42;

	override readonly version = Migration042SurvivalistPoisonSave.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'background') return;
		if (!this.#isSurvivalist(source)) return;

		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: any[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);

		if (rules.some((rule) => rule?.id === POISON_SAVE_RULE.id)) return;

		rules.push({ ...POISON_SAVE_RULE });
		console.log(`Nimble Migration | ${source.name ?? 'Survivalist'}: added poison save reminder`);
	}

	#isSurvivalist(source: any): boolean {
		if (toSnapshotId(this.getSourceId(source)) === SURVIVALIST_SOURCE_ID) return true;
		return typeof source.name === 'string' && source.name.trim().toLowerCase() === 'survivalist';
	}
}

export { Migration042SurvivalistPoisonSave };
