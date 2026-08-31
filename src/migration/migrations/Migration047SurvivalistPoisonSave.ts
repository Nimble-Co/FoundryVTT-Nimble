import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

const COMPENDIUM_PREFIX = 'Compendium.';

const SURVIVALIST_SOURCE_ID = 'Compendium.nimble.nimble-backgrounds.Item.qKknqLqzT7BReZul';

/** Matches the rule the pack now ships, id included, so migrated copies behave identically. */
const POISON_ADVANTAGE_RULE = {
	type: 'situationalRollMode',
	disabled: false,
	id: '8pUORSgg0CfUHYPc',
	identifier: '',
	label: 'Against poison',
	predicate: {},
	priority: 1,
	value: 1,
	checkType: 'savingThrow',
	saves: ['strength'],
	abilities: [],
	skills: [],
};

interface RuleSource {
	type?: string;
	checkType?: string;
	saves?: string[];
	id?: string;
}

/**
 * Backfills the Survivalist background's "Advantage against poison saves" automation.
 *
 * The background shipped with only its `maxHitDice` rule, so every existing copy
 * embedded on a character has nothing for the poison clause, and updating the pack
 * alone does not reach one: the check roll dialog reads the rules on the actor's own
 * items. Two places need the rule, mirroring Migration045HauntedPastFearAdvantage:
 * the embedded background on each character, and any world-level copy, so characters
 * built from it later carry the rule too.
 *
 * Poison is a STR save, which is why the rule names `strength` rather than applying to
 * every save. STR also covers forced movement, restraint and extreme temperatures, none
 * of which Survivalist helps with, so the advantage is offered per roll instead of being
 * stored. `situationalRollMode` needs no persisted counterpart: it does not feed
 * `savingThrows.strength.defaultRollMode`, because the roller opts in per save, and the
 * stored roll mode is left exactly as the player configured it.
 */
class Migration047SurvivalistPoisonSave extends MigrationBase {
	static override readonly version = 47;

	override readonly version = Migration047SurvivalistPoisonSave.version;

	/**
	 * A compendium id identifies the item outright, so a background from some other
	 * pack is left alone even when it shares the name. Anything else falls back to the
	 * name: a world-item copy (`Item.<id>`, which is what the creation dialog stamps
	 * when the GM has imported the pack into the sidebar), or no id at all.
	 */
	#isSurvivalist(item: any): boolean {
		if (item?.type !== 'background') return false;
		const sourceId = toSnapshotId(this.getSourceId(item));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) return sourceId === SURVIVALIST_SOURCE_ID;
		return item?.name === 'Survivalist';
	}

	/**
	 * Adds the rule unless an equivalent is already there. Matched by shape as well as
	 * id: the background's description promised advantage against poison saves while
	 * shipping no rule for it, so a GM may well have authored the same rule by hand,
	 * and theirs carries a random id.
	 *
	 * The signature deliberately omits `value` and `disabled`: ANY STR
	 * `situationalRollMode` on this background counts as the GM having already
	 * expressed intent, including a disabled one or an oppositely-signed homebrew
	 * penalty. Adding a second rule beside either would offer the player two competing
	 * toggles for one line of text.
	 */
	#addRule(system: any): void {
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules: RuleSource[] = system.rules;

		const alreadyPresent = rules.some(
			(rule) =>
				rule?.id === POISON_ADVANTAGE_RULE.id ||
				(rule?.type === POISON_ADVANTAGE_RULE.type &&
					rule?.checkType === POISON_ADVANTAGE_RULE.checkType &&
					Array.isArray(rule?.saves) &&
					rule.saves.includes('strength')),
		);
		if (alreadyPresent) return;

		rules.push(foundry.utils.deepClone(POISON_ADVANTAGE_RULE));
	}

	/** World-level copies, so characters created from them later carry the rule too. */
	override async updateItem(source: any, parent?: any): Promise<void> {
		// Embedded items are reached through `updateActor`.
		if (parent) return;
		if (!this.#isSurvivalist(source) || !source.system) return;

		this.#addRule(source.system);
	}

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const items: any[] = Array.isArray(source.items) ? source.items : [];
		const survivalist = items.find((item) => this.#isSurvivalist(item));
		if (!survivalist?.system) return;

		this.#addRule(survivalist.system);
	}
}

export { Migration047SurvivalistPoisonSave };
