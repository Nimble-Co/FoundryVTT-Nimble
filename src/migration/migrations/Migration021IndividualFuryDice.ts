import { MigrationBase } from '../MigrationBase.js';

const FURY_LEVEL_OVERRIDES: Record<string, { faces: number; quantity: string }> = {
	'6': { faces: 6, quantity: '' },
	'9': { faces: 8, quantity: '' },
	'13': { faces: 10, quantity: '' },
	'17': { faces: 12, quantity: '' },
};

const SECOND_FURY_RULE = {
	type: 'dicePool',
	disabled: false,
	id: 'Lm7xQ4wR9pKv3sTn',
	identifier: 'fury-dice',
	label: 'Fury Dice',
	predicate: { level: { min: 5 } },
	priority: 2,
	faces: 4,
	quantity: '@key',
	poolMode: 'individual',
	resetOnEncounterEnd: true,
	fillOnInitiative: false,
	rollOnActivation: true,
	levels: { ...FURY_LEVEL_OVERRIDES },
};

/**
 * Upgrades embedded fury-dice pool rules to the `individual` pool mode.
 *
 * Earlier migrations left fury-dice as `resource` or `accumulate`. This
 * migration corrects that to `individual`, backfills the die-face level
 * overrides (d6 at 6, d8 at 9, d10 at 13, d12 at 17), and adds the second
 * dicePool rule (level 5+ predicate) if it was never embedded.
 */
class Migration021IndividualFuryDice extends MigrationBase {
	static override readonly version = 21;

	override readonly version = Migration021IndividualFuryDice.version;

	override async updateItem(source: any): Promise<void> {
		const rules: any[] | undefined = source.system?.rules;
		if (!Array.isArray(rules)) return;

		const furyRules = rules.filter((r) => r.type === 'dicePool' && r.identifier === 'fury-dice');
		if (furyRules.length === 0) return;

		for (const rule of furyRules) {
			rule.poolMode = 'individual';
			rule.rollOnActivation = true;
			rule.resetOnEncounterEnd = true;
			rule.fillOnInitiative = false;
			rule.quantity = '@key';

			if (!rule.levels) rule.levels = {};
			for (const [lvl, override] of Object.entries(FURY_LEVEL_OVERRIDES)) {
				rule.levels[lvl] = override;
			}
			// Remove empty placeholders left by earlier migrations
			for (const [lvl, override] of Object.entries(rule.levels)) {
				if ((override as any).faces === 0 && (override as any).quantity === '') {
					delete rule.levels[lvl];
				}
			}
		}

		// Add the level-5+ rule if missing
		const hasSecondRule = furyRules.some(
			(r) => r.predicate?.level?.min === 5 || r.id === SECOND_FURY_RULE.id,
		);
		if (!hasSecondRule) {
			source.system.rules.push({ ...SECOND_FURY_RULE });
		}
	}
}

export { Migration021IndividualFuryDice };
