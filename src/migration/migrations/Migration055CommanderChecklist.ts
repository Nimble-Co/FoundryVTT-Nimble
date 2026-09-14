import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type Node = Record<string, unknown> & { id?: unknown; type?: unknown };

const COMPENDIUM_PREFIX = 'Compendium.';

const CLASS_IDENTIFIER = 'commander';

const FIT_FOR_ANY_BATTLEFIELD = {
	sourceId: 'Compendium.nimble.nimble-class-features.Item.JiNcaklfRjgJ7e5W',
	name: 'fit for any battlefield',
} as const;

const HOLD_THE_LINE = {
	sourceId: 'Compendium.nimble.nimble-class-features.Item.9BEzKcYWuIcKtmie',
	name: 'hold the line!',
} as const;

const I_CAN_DO_THIS_ALL_DAY = {
	sourceId: 'Compendium.nimble.nimble-class-features.Item.sYJ4IREnwdrhzp8E',
	name: 'i can do this all day!',
} as const;

const COMMANDING_PRESENCE = {
	sourceId: 'Compendium.nimble.nimble-class-features.Item.cmrCy26QPZrZ0eFN',
	name: 'commanding presence',
} as const;

/** The Combat Dice pool the feature ships, matched by rule id. */
const COMBAT_DICE_POOL_ID = 'combat-dice-pool';

/** Combat Dice are lost when combat ends, which the pool never expressed. */
const COMBAT_DICE_ENCOUNTER_END = { trigger: 'encounterEnd', mode: 'set', value: '0' };

/** The bare warning the order shipped in place of an effect. */
const HOLD_THE_LINE_OLD_NOTE_TEXT = 'Set their HP to 3× your LVL.';

const HOLD_THE_LINE_HEALING = {
	id: 'IBAV55mrssf6bXJT',
	type: 'healing',
	healingType: 'healing',
	formula: '3 * @level',
	targetDisposition: 'friendly',
	parentContext: null,
	parentNode: null,
};

const HOLD_THE_LINE_REMINDER = {
	id: 'rYpZpBzMBZLtQIsD',
	type: 'note',
	noteType: 'reminder',
	text: 'Set their HP to 3× your LVL: this heals a creature at 0 HP to that amount.',
	parentContext: null,
	parentNode: null,
};

const HOLD_THE_LINE_OLD_DESCRIPTION =
	'<p><em>(1/encounter)</em> <strong>Reaction</strong> (when an ally drops to 0 HP): Command them to continue the fight! Set their HP to 3× your LVL. (M)</p>';

const HOLD_THE_LINE_DESCRIPTION =
	'<p><em>(1/encounter)</em> <strong>Reaction</strong> (when an ally drops to 0 HP): Command them to continue the fight! Set their HP to 3× your LVL.</p>';

const ALL_DAY_OLD_DESCRIPTION =
	'<p><em>(1/encounter)</em> <strong>Reaction</strong> (when you would drop to 0 HP): You may expend any number of Hit Dice and set your HP to the sum rolled instead (do not add your STR). </p><p></p>';

const ALL_DAY_DESCRIPTION =
	'<p><em>(1/encounter)</em> <strong>Reaction</strong> (when you would drop to 0 HP): You may expend any number of Hit Dice and set your HP to the sum rolled instead (do not add your STR).</p>';

/** The damage the tactic rolled although the rules give it no damage at all. */
const COMMANDING_PRESENCE_OLD_DAMAGE = { id: '7PnCCAempcQf8NJd', formula: '10+@strength' };

const COMMANDING_PRESENCE_OLD_NOTE = {
	id: 'IsAy46e12s3J0Ao1',
	text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
};

function nodes(source: any): Node[] | undefined {
	const effects = source?.system?.activation?.effects;
	return Array.isArray(effects) ? effects : undefined;
}

/**
 * Repairs four Commander features against the rulebook.
 *
 * Fit for Any Battlefield loses its Combat Dice when combat ends, Hold the Line!
 * heals instead of only telling the GM a number, I Can Do This ALL DAY! costs the
 * reaction it always was, and Commanding Presence stops rolling damage it never
 * had. The pack alone does not reach an embedded copy on a character, so each
 * change is repeated here.
 *
 * Matches on compendium source id, falling back to class plus item name for copies
 * without one. Every write is guarded on the stored value still being the old pack
 * value, so a GM edit stays, an added node or rule stays, and a second run changes
 * nothing.
 */
class Migration055CommanderChecklist extends MigrationBase {
	static override readonly version = 55;

	override readonly version = Migration055CommanderChecklist.version;

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature') return;

		if (this.#matches(source, FIT_FOR_ANY_BATTLEFIELD)) this.#addCombatDiceExpiry(source);
		else if (this.#matches(source, HOLD_THE_LINE)) this.#healWithHoldTheLine(source);
		else if (this.#matches(source, I_CAN_DO_THIS_ALL_DAY)) this.#chargeTheReaction(source);
		else if (this.#matches(source, COMMANDING_PRESENCE)) this.#dropPresenceDamage(source);
	}

	/**
	 * A compendium id identifies the feature outright, so a feature from another
	 * pack is left alone even when it shares the name. Anything else falls back to
	 * the class plus the name: a world-item copy (`Item.<id>`), or no id at all.
	 */
	#matches(source: any, feature: { sourceId: string; name: string }): boolean {
		const sourceId = toSnapshotId(this.getSourceId(source));
		if (sourceId?.startsWith(COMPENDIUM_PREFIX)) return sourceId === feature.sourceId;

		if (source.system?.class !== CLASS_IDENTIFIER) return false;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return name === feature.name;
	}

	/** Combat Dice are lost when combat ends. */
	#addCombatDiceExpiry(source: any): void {
		const rules = source.system?.rules;
		if (!Array.isArray(rules)) return;

		const pool: any = rules.find((rule: any) => rule?.id === COMBAT_DICE_POOL_ID);
		if (!pool) return;

		if (pool.recoveries === undefined || pool.recoveries === null) pool.recoveries = [];
		if (!Array.isArray(pool.recoveries)) return;
		if (pool.recoveries.some((recovery: any) => recovery?.trigger === 'encounterEnd')) return;

		pool.recoveries.push(foundry.utils.deepClone(COMBAT_DICE_ENCOUNTER_END));
		console.log('Nimble Migration | Fit for Any Battlefield: Combat Dice expire when combat ends');
	}

	/**
	 * Turns the warning into a heal. The old note carried the whole effect as text,
	 * so it is replaced in place by the healing node and a reminder that the heal
	 * reaches a creature at 0 HP.
	 */
	#healWithHoldTheLine(source: any): void {
		const effects = nodes(source);
		if (effects) {
			const index = effects.findIndex(
				(node) => node?.type === 'note' && node?.text === HOLD_THE_LINE_OLD_NOTE_TEXT,
			);
			const alreadyHeals = effects.some((node) => node?.type === 'healing');

			if (index >= 0 && !alreadyHeals) {
				effects.splice(
					index,
					1,
					foundry.utils.deepClone(HOLD_THE_LINE_HEALING),
					foundry.utils.deepClone(HOLD_THE_LINE_REMINDER),
				);
				console.log('Nimble Migration | Hold the Line!: replaced the warning with a heal');
			}
		}

		if (source.system?.description === HOLD_THE_LINE_OLD_DESCRIPTION) {
			source.system.description = HOLD_THE_LINE_DESCRIPTION;
		}
	}

	/** The order is a reaction, so it costs one. */
	#chargeTheReaction(source: any): void {
		const cost = source.system?.activation?.cost;
		if (cost?.type === 'none' && cost?.quantity === 1 && cost?.isReaction === true) {
			cost.type = 'action';
			console.log('Nimble Migration | I Can Do This ALL DAY!: the reaction now costs an action');
		}

		if (source.system?.description === ALL_DAY_OLD_DESCRIPTION) {
			source.system.description = ALL_DAY_DESCRIPTION;
		}
	}

	/** The tactic imposes a save, it deals no damage. */
	#dropPresenceDamage(source: any): void {
		const effects = nodes(source);
		if (!effects) return;

		const damage = effects.findIndex(
			(node) =>
				node?.id === COMMANDING_PRESENCE_OLD_DAMAGE.id &&
				node?.type === 'damage' &&
				node?.formula === COMMANDING_PRESENCE_OLD_DAMAGE.formula,
		);
		if (damage >= 0) effects.splice(damage, 1);

		// The note goes with the damage, so a damage node the GM kept keeps it too.
		const keepsDamage = effects.some((node) => node?.type === 'damage');
		const note = keepsDamage
			? -1
			: effects.findIndex(
					(node) =>
						node?.id === COMMANDING_PRESENCE_OLD_NOTE.id &&
						node?.type === 'note' &&
						node?.text === COMMANDING_PRESENCE_OLD_NOTE.text,
				);
		if (note >= 0) effects.splice(note, 1);

		if (damage >= 0) {
			console.log('Nimble Migration | Commanding Presence: removed the damage it never dealt');
		} else if (note >= 0) {
			console.log('Nimble Migration | Commanding Presence: removed the combat tactics note');
		}
	}
}

export { Migration055CommanderChecklist };
