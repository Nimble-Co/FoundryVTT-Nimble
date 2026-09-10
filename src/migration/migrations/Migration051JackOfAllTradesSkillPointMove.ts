import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const JACK_OF_ALL_TRADES_SOURCE_ID =
	'Compendium.nimble.nimble-class-features.Item.H6rFmCzodKZYW3ye';

/** The cost details the feature shipped with, back when it was written up as a reaction. */
const LEGACY_COST_DETAILS = 'An ally makes a roll';

/** Matches the rule the pack ships, id included, so a migrated copy and a fresh import behave alike. */
const SKILL_POINT_MOVE_RULE = {
	id: 'oCCxKr1vIWc7C6QN',
	type: 'skillPointMove',
	label: 'When you Safe Rest',
	disabled: false,
	predicate: {},
	priority: 1,
	points: 1,
	trigger: 'safeRest',
};

/**
 * Backfills the Songweaver "Jack of All Trades" automation and corrects its activation.
 *
 * The feature shipped with no rules, so the skill point move it describes was never offered on
 * a Safe Rest, and its activation described a reaction to an ally's roll, which the feature
 * never was. Updating the pack alone does not reach an existing world: the copy embedded on a
 * character, and any copy the GM imported into the sidebar, keep the old data.
 *
 * Copies are matched by compendium source id only. The name alone would also catch a homebrew
 * feature that borrows the title, and this rewrite is specific to the printed one.
 */
class Migration051JackOfAllTradesSkillPointMove extends MigrationBase {
	static override readonly version = 51;

	override readonly version = Migration051JackOfAllTradesSkillPointMove.version;

	#isJackOfAllTrades(source: any): boolean {
		if (source?.type !== 'feature') return false;
		return toSnapshotId(this.getSourceId(source)) === JACK_OF_ALL_TRADES_SOURCE_ID;
	}

	/**
	 * Adds the rule unless the item already carries one of its type. Matched by type rather
	 * than id so a GM who authored the same automation by hand, under a random id, is not
	 * given a second copy that would offer the move twice.
	 */
	static #addRule(system: Record<string, unknown>): void {
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules = system.rules as Record<string, unknown>[];

		if (rules.some((rule) => rule?.type === SKILL_POINT_MOVE_RULE.type)) return;
		rules.push(foundry.utils.deepClone(SKILL_POINT_MOVE_RULE));
	}

	/**
	 * Clears the reaction wording. Only the shipped values are replaced, so a GM who has
	 * already retyped the cost themselves keeps what they wrote.
	 */
	static #fixActivation(system: Record<string, unknown>): void {
		const activation = system.activation as Record<string, unknown> | undefined;
		const cost = activation?.cost as Record<string, unknown> | undefined;
		if (!cost) return;

		if (cost.details === LEGACY_COST_DETAILS) cost.details = '';
		if (cost.isReaction === true) cost.isReaction = false;
	}

	/** Reached for both world-level copies and the copy embedded on each character. */
	override async updateItem(source: any): Promise<void> {
		if (!this.#isJackOfAllTrades(source) || !source.system) return;

		Migration051JackOfAllTradesSkillPointMove.#addRule(source.system);
		Migration051JackOfAllTradesSkillPointMove.#fixActivation(source.system);
	}
}

export { Migration051JackOfAllTradesSkillPointMove };
