import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';

const HAUNTED_PAST_SOURCE_ID = 'Compendium.nimble.nimble-backgrounds.Item.TfYvarCWkHj2qVfa';

/** Matches the rule the pack now ships, id included, so migrated copies behave identically. */
const FEAR_ADVANTAGE_RULE = {
	type: 'savingThrowRollMode',
	disabled: false,
	id: 'NWCRKRwheYMcCuFN',
	identifier: '',
	label: 'Haunted Past',
	predicate: {},
	priority: 2,
	value: 1,
	target: 'will',
	mode: 'adjust',
	requiresChoice: false,
} as const;

/**
 * Save keys as of this migration. Snapshotted rather than read from `CONFIG`:
 * a migration has to describe the world as it was when it shipped.
 */
const SAVE_KEYS = ['strength', 'dexterity', 'intelligence', 'will'] as const;

const MIN_ROLL_MODE = -3;
const MAX_ROLL_MODE = 3;

interface RuleSource {
	type?: string;
	disabled?: boolean;
	priority?: number;
	requiresChoice?: boolean;
	selectedSave?: string | null;
	target?: string;
	mode?: string;
	value?: number;
	id?: string;
}

/** Mirrors `resolveTargetSaves` in the character creation flow. */
function targetSaves(rule: RuleSource, rollModes: Record<string, number>): string[] {
	const { selectedSave } = rule;
	// `'all'` matches the schema's initial value, which a raw `_source` rule
	// authored before the field existed may not carry.
	const target = rule.target ?? 'all';
	if (selectedSave && SAVE_KEYS.includes(selectedSave as never)) return [selectedSave];
	if (target && SAVE_KEYS.includes(target as never)) return [target];
	switch (target) {
		case 'all':
			return [...SAVE_KEYS];
		case 'advantaged':
			return SAVE_KEYS.filter((key) => rollModes[key] > 0);
		case 'disadvantaged':
			return SAVE_KEYS.filter((key) => rollModes[key] < 0);
		case 'neutral':
			return SAVE_KEYS.filter((key) => rollModes[key] === 0);
		default:
			return [];
	}
}

/**
 * Replays the roll-mode resolution — class defaults, then every enabled
 * `savingThrowRollMode` rule in `priority` order.
 *
 * Scoped like `resetSavingThrowRollModes` (every embedded item) rather than like
 * character creation (the four origin documents only). The two live consumers
 * genuinely differ here; they agree on all shipped content, since only ancestry
 * bonuses and backgrounds carry this rule type.
 *
 * Deliberately a local copy rather than an import: a migration must keep
 * reproducing the arithmetic as it stood when it shipped, even after the live
 * resolvers change.
 */
function resolveRollModes(classSaves: any, rules: RuleSource[]): Record<string, number> {
	const rollModes: Record<string, number> = Object.fromEntries(SAVE_KEYS.map((key) => [key, 0]));

	if (classSaves?.advantage) rollModes[classSaves.advantage] = 1;
	if (classSaves?.disadvantage) rollModes[classSaves.disadvantage] = -1;

	const ordered = rules
		.filter((rule) => !rule?.disabled && rule?.type === 'savingThrowRollMode')
		.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));

	for (const rule of ordered) {
		if (rule.requiresChoice && !rule.selectedSave) continue;

		for (const saveKey of targetSaves(rule, rollModes)) {
			rollModes[saveKey] =
				rule.mode === 'adjust'
					? Math.max(MIN_ROLL_MODE, Math.min(MAX_ROLL_MODE, rollModes[saveKey] + (rule.value ?? 0)))
					: (rule.value ?? 0);
		}
	}

	return rollModes;
}

/**
 * Backfills the Haunted Past background's "Advantage against fear" automation.
 *
 * The background shipped with `rules: []`, so every existing copy embedded on a
 * character has no rule. `savingThrowRollMode` has no data-prep hook — it is
 * resolved once at character creation and by the "Reset to Class Defaults"
 * button — so unlike a hook-driven rule (e.g. `conditionImmunity` on Fearless),
 * updating the pack alone changes nothing for an existing character. Both halves
 * are needed, mirroring Migration022CelestialSavingThrow:
 *
 * 1. Push the rule onto the embedded background so "Reset to Class Defaults"
 *    accounts for it from now on.
 * 2. Adjust the actor's persisted `savingThrows.will.defaultRollMode`, which is
 *    the value actually rolled against.
 *
 * Step 2 only fires when the stored roll mode still equals what the character's
 * own class and rules would have produced without this one — replayed in full,
 * so a Celestial/Highborn character whose WIL was already neutralized is
 * recognized rather than skipped. A roll mode hand-tuned in the saving throw
 * config dialog does not match the replay and is left alone.
 */
class Migration044HauntedPastFearAdvantage extends MigrationBase {
	static override readonly version = 44;

	override readonly version = Migration044HauntedPastFearAdvantage.version;

	/**
	 * A compendium id identifies the item outright, so a background from some
	 * other pack is left alone even when it shares the name. Anything else — a
	 * world-item copy (`Item.<id>`, which is what the creation dialog stamps when
	 * the GM has imported the pack into the sidebar, the case Migration022 was
	 * written for) or no id at all — falls back to the name.
	 */
	#isHauntedPast(item: any): boolean {
		if (item?.type !== 'background') return false;
		const sourceId = toSnapshotId(this.getSourceId(item));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) return sourceId === HAUNTED_PAST_SOURCE_ID;
		return item?.name === 'Haunted Past';
	}

	/**
	 * Adds the rule unless an equivalent is already there. Matched by shape as
	 * well as id: the background shipped with `rules: []` while its description
	 * promised advantage against fear, so a GM may well have authored the same
	 * rule by hand — and theirs carries a random id. Returns whether it was added.
	 *
	 * The signature deliberately omits `value` and `disabled`: ANY `will`/`adjust`
	 * rule on this background counts as the GM having already expressed intent,
	 * including a disabled one or an oppositely-signed homebrew penalty. Backfilling
	 * over either would net a number nobody chose, so the migration stands down.
	 */
	#addRule(system: any): boolean {
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules: RuleSource[] = system.rules;

		const alreadyPresent = rules.some(
			(rule) =>
				rule?.id === FEAR_ADVANTAGE_RULE.id ||
				(rule?.type === FEAR_ADVANTAGE_RULE.type &&
					rule?.target === FEAR_ADVANTAGE_RULE.target &&
					rule?.mode === FEAR_ADVANTAGE_RULE.mode),
		);
		if (alreadyPresent) return false;

		rules.push(foundry.utils.deepClone(FEAR_ADVANTAGE_RULE));
		return true;
	}

	/** World-level copies, so characters built from them later carry the rule too. */
	override async updateItem(source: any, parent?: any): Promise<void> {
		// Embedded items belong to `updateActor`, which also fixes the roll mode.
		if (parent) return;
		if (!this.#isHauntedPast(source) || !source.system) return;

		this.#addRule(source.system);
	}

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];

		const hauntedPast = items.find((item) => this.#isHauntedPast(item));

		if (!hauntedPast?.system) return;

		const classSaves = items.find((item) => item?.type === 'class')?.system?.savingThrows;
		const allRules = (): RuleSource[] => items.flatMap((item) => item?.system?.rules ?? []);

		// Step 1 stands on its own: the rule belongs on the item even when there is
		// no class to resolve a roll mode against.
		if (!classSaves) {
			this.#addRule(hauntedPast.system);
			return;
		}

		const before = resolveRollModes(classSaves, allRules());
		// Idempotent: re-running must not stack a second +1 onto the roll mode.
		if (!this.#addRule(hauntedPast.system)) return;

		const willSave = source.system?.savingThrows?.will;
		if (willSave?.defaultRollMode !== before.will) return;

		willSave.defaultRollMode = resolveRollModes(classSaves, allRules()).will;
	}
}

export { Migration044HauntedPastFearAdvantage };
