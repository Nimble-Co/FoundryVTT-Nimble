import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const SURVIVALIST_SOURCE_ID = 'Compendium.nimble.nimble-backgrounds.Item.qKknqLqzT7BReZul';

/** The shape a stored rule entry is read back as. */
type RuleSource = Record<string, unknown> & { id?: unknown };

/**
 * The rule the pack now ships. The id matches the pack entry so a migrated copy
 * behaves identically to a freshly dragged one.
 */
const POISON_SAVE_RULE = {
	type: 'savingThrowRollMode',
	label: 'Survivalist',
	value: 1,
	mode: 'adjust',
	situation: 'poison',
	id: '8pUORSgg0CfUHYPc',
} as const;

/**
 * Backfills the Survivalist background's "Advantage against poison saves" rule,
 * which the pack gained after the background was already draggable.
 *
 * The rule is situational, so it changes no stored value on the actor — it only
 * needs to be present on the embedded item for the saving throw config dialog to
 * list it. Existing rules are left alone, so a hand-authored equivalent is kept
 * and only duplicated if it carries a different id.
 *
 * Note the limit of the name fallback. A background whose stored source id does not
 * match the pack entry — missing, or pointing at a world or homebrew copy — is matched
 * on its name alone, so a GM's own background called "Survivalist" also gains the rule.
 * There is no better signal on a background: unlike a class feature it carries no
 * `system.class` to narrow against, and skipping every unmatched copy would miss the
 * imported characters this migration exists for.
 */
class Migration047SurvivalistPoisonSave extends MigrationBase {
	static override readonly version = 47;

	override readonly version = Migration047SurvivalistPoisonSave.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'background') return;
		if (!this.#isSurvivalist(source)) return;

		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: RuleSource[] = Array.isArray(system.rules) ? system.rules : (system.rules = []);

		if (rules.some((rule) => rule?.id === POISON_SAVE_RULE.id)) return;

		rules.push({ ...POISON_SAVE_RULE });
		console.log(`Nimble Migration | ${source.name ?? 'Survivalist'}: added poison save reminder`);
	}

	#isSurvivalist(source: any): boolean {
		if (toSnapshotId(this.getSourceId(source)) === SURVIVALIST_SOURCE_ID) return true;
		return typeof source.name === 'string' && source.name.trim().toLowerCase() === 'survivalist';
	}
}

export { Migration047SurvivalistPoisonSave };
