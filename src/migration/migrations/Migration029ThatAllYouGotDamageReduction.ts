import { MigrationBase } from '../MigrationBase.js';

const TAYG_SOURCE_ID = 'Compendium.nimble.nimble-class-features.Item.4oQQtqOhqe9KO5g9';

// Canonical descriptions the pack has shipped with; only these are upgraded
// so hand-customized descriptions are left alone.
const OLD_DESCRIPTIONS = new Set([
	'<p>When you are attacked, you may expend 1 or more Fury Dice to reduce the damage taken by STR+DEX for each die spent.</p>',
	'<p><strong>Reaction</strong> (when you are attacked): expend 1 or more Fury Dice to reduce the damage taken by (STR+DEX) for each die spent.</p><p><em>Click your Fury Dice pool icon on the sheet to open the spend dialog, then pick this feature as the preset. The reduction is banked and applied automatically to the next damage you take.</em></p>',
	'<p><strong>Reaction</strong> (when you are attacked): expend 1 or more Fury Dice to reduce the damage taken by (STR+DEX) for each die spent.</p><p><em>Click your Fury Dice pool icon on the sheet to open the spend dialog, then pick this feature as the preset, it will roll (STR+DEX) × N for you.</em></p>',
]);

const NEW_DESCRIPTION =
	'<p><strong>Reaction</strong> (when you are attacked): expend 1 or more Fury Dice to reduce the damage taken by (STR+DEX) for each die spent.</p><p><em>Click this feature to use it.</em></p>';

type RuleSource = { type?: unknown; mode?: unknown; effectType?: unknown };

/**
 * Reconciles embedded copies of "That all you got?!" with the damageReduction
 * spend effect (#580): the manual Fury Dice consumer gains
 * `effectType: 'damageReduction'` so spends bank the rolled total as a
 * one-shot damage reduction instead of posting a plain generic-spend card.
 * Canonical descriptions are updated to the click-to-use wording.
 *
 * Matches on compendium source id, falling back to berserker class + item
 * name for copies without one. Idempotent: rules that already carry an
 * effectType other than 'generic' are left alone.
 */
class Migration029ThatAllYouGotDamageReduction extends MigrationBase {
	static override readonly version = 29;

	override readonly version = Migration029ThatAllYouGotDamageReduction.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;
		if (!this.#matches(source)) return;

		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: RuleSource[] = Array.isArray(system.rules) ? system.rules : [];
		let changed = false;

		for (const rule of rules) {
			if (rule?.type !== 'diceConsumer' || rule?.mode !== 'manual') continue;
			if (rule.effectType && rule.effectType !== 'generic') continue;
			rule.effectType = 'damageReduction';
			changed = true;
		}

		if (typeof system.description === 'string' && OLD_DESCRIPTIONS.has(system.description)) {
			system.description = NEW_DESCRIPTION;
			changed = true;
		}

		if (changed) {
			// eslint-disable-next-line no-console
			console.log(
				`Nimble Migration | ${source.name ?? TAYG_SOURCE_ID}: banked damage-reduction spend effect`,
			);
		}
	}

	#matches(source: any): boolean {
		if (this.getSourceId(source) === TAYG_SOURCE_ID) return true;
		if (source?.system?.class !== 'berserker') return false;
		return (
			typeof source.name === 'string' && source.name.trim().toLowerCase() === 'that all you got?!'
		);
	}
}

export { Migration029ThatAllYouGotDamageReduction };
