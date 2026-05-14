import { MigrationBase } from '../MigrationBase.js';

/**
 * Backfills `poolMode`, `resetOnEncounterEnd`, and `fillOnInitiative` on
 * existing `dicePool` rules that pre-date these fields.
 *
 * These fields were added in the dice-pools feature branch. Actors who already
 * had Berserker, Commander, or Oathsworn features embedded will have `dicePool`
 * rules in their stored items without these properties; Foundry's DataModel
 * fills in schema defaults at runtime, but those defaults are wrong for rules
 * that require non-default lifecycle behaviour.
 *
 * Pool mode semantics:
 * - 'resource'   : count-based, spent one pip at a time (Commander Combat Dice)
 * - 'accumulate' : roll one die, add value to running total (Berserker Fury Dice)
 * - 'store'      : roll full pool, store total, expend to clear (Oathsworn Judgement Dice)
 *
 * Resolution per rule (by well-known identifier):
 * - combat-dice   → poolMode: 'resource', resetOnEncounterEnd: true, fillOnInitiative: true
 * - fury-dice     → poolMode: 'accumulate', resetOnEncounterEnd: true
 * - judgment-dice → poolMode: 'store'
 * - unknown       → poolMode: 'resource' (safe default)
 *
 * Also removes the legacy `rollable` field if present (superseded by poolMode).
 */
class Migration019DicePoolFields extends MigrationBase {
	static override readonly version = 19;

	override readonly version = Migration019DicePoolFields.version;

	override async updateItem(source: any): Promise<void> {
		const rules: any[] | undefined = source.system?.rules;
		if (!Array.isArray(rules)) return;

		for (const rule of rules) {
			if (rule.type !== 'dicePool') continue;

			const id: string = rule.identifier ?? '';
			const _before = {
				poolMode: rule.poolMode,
				resetOnEncounterEnd: rule.resetOnEncounterEnd,
				fillOnInitiative: rule.fillOnInitiative,
				rollable: rule.rollable,
			};

			// Remove legacy rollable field (superseded by poolMode)
			delete rule.rollable;

			// For known identifiers always enforce the correct mode; for unknowns
			// only backfill if missing (preserves any intentional value).
			if (id === 'fury-dice') {
				rule.poolMode = 'individual';
				rule.resetOnEncounterEnd = true;
				rule.fillOnInitiative ??= false;
			} else if (id === 'judgment-dice') {
				rule.poolMode = 'store';
				rule.resetOnEncounterEnd ??= false;
				rule.fillOnInitiative ??= false;
			} else if (id === 'combat-dice') {
				rule.poolMode = 'resource';
				rule.resetOnEncounterEnd = true;
				rule.fillOnInitiative = true;
			} else {
				rule.poolMode ??= 'resource';
				rule.resetOnEncounterEnd ??= false;
				rule.fillOnInitiative ??= false;
			}
		}
	}
}

export { Migration019DicePoolFields };
