import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';

const HAUNTED_PAST_SOURCE_ID = 'Compendium.nimble.nimble-backgrounds.Item.TfYvarCWkHj2qVfa';

/** Matches the rule the pack now ships, id included, so migrated copies behave identically. */
const FEAR_ADVANTAGE_RULE = {
	type: 'situationalRollMode',
	disabled: false,
	id: 'N43aM4mMNGpq5WN6',
	identifier: '',
	label: 'Against fear',
	predicate: {},
	priority: 1,
	value: 1,
	checkType: 'savingThrow',
	saves: ['will'],
	abilities: [],
	skills: [],
};

/**
 * The blanket WIL rule an earlier draft of this migration installed, before the
 * situational option existed. Matched by its own pack id, which is provably ours
 * rather than a GM's hand-authored rule.
 */
const SUPERSEDED_BLANKET_RULE_ID = 'NWCRKRwheYMcCuFN';

interface RuleSource {
	type?: string;
	target?: string;
	mode?: string;
	checkType?: string;
	saves?: string[];
	id?: string;
}

/**
 * Backfills the Haunted Past background's "Advantage against fear" automation.
 *
 * The background shipped with `rules: []`, so every existing copy embedded on a
 * character has no rule, and updating the pack alone does not reach one: the
 * check roll dialog reads the rules on the actor's own items. Two places need the
 * rule, mirroring Migration022CelestialSavingThrow: the embedded background on
 * each character, and any world-level copy, so characters built from it later
 * carry the rule too.
 *
 * `situationalRollMode` needs no persisted counterpart. Unlike the
 * `savingThrowRollMode` rule this migration originally installed, it does not
 * feed `savingThrows.will.defaultRollMode`: the roller opts in per save, so the
 * stored roll mode is left exactly as the player configured it. A character
 * carrying the superseded blanket rule from a pre-release build loses it here;
 * "Reset to Class Defaults" in the saving throw config then recomputes a WIL roll
 * mode without it.
 */
class Migration045HauntedPastFearAdvantage extends MigrationBase {
	static override readonly version = 45;

	override readonly version = Migration045HauntedPastFearAdvantage.version;

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
	 * rule by hand — and theirs carries a random id.
	 *
	 * The signature deliberately omits `value` and `disabled`: ANY WIL
	 * `situationalRollMode` on this background counts as the GM having already
	 * expressed intent, including a disabled one or an oppositely-signed homebrew
	 * penalty. Adding a second rule beside either would offer the player two
	 * competing toggles for one line of text.
	 */
	#replaceRules(system: any): void {
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules: RuleSource[] = system.rules;

		const supersededIndex = rules.findIndex((rule) => rule?.id === SUPERSEDED_BLANKET_RULE_ID);
		if (supersededIndex !== -1) rules.splice(supersededIndex, 1);

		const alreadyPresent = rules.some(
			(rule) =>
				rule?.id === FEAR_ADVANTAGE_RULE.id ||
				(rule?.type === FEAR_ADVANTAGE_RULE.type &&
					rule?.checkType === FEAR_ADVANTAGE_RULE.checkType &&
					Array.isArray(rule?.saves) &&
					rule.saves.includes('will')),
		);
		if (alreadyPresent) return;

		rules.push(foundry.utils.deepClone(FEAR_ADVANTAGE_RULE));
	}

	/** World-level copies, so characters created from them later carry the rule too. */
	override async updateItem(source: any, parent?: any): Promise<void> {
		// Embedded items are reached through `updateActor`.
		if (parent) return;
		if (!this.#isHauntedPast(source) || !source.system) return;

		this.#replaceRules(source.system);
	}

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];
		const hauntedPast = items.find((item) => this.#isHauntedPast(item));
		if (!hauntedPast?.system) return;

		this.#replaceRules(hauntedPast.system);
	}
}

export { Migration045HauntedPastFearAdvantage };
