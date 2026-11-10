import { choiceLabels } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

const AMOUNT_CHOICES = ['taken', 'critDice'] as const;

function schema() {
	const { fields } = foundry.data;

	return {
		onlyCrits: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: true,
			label: 'NIMBLE.rules.damageBack.onlyCrits.label',
			hint: 'NIMBLE.rules.damageBack.onlyCrits.hint',
		}),
		amount: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'taken',
			choices: choiceLabels('damageBack', 'amount', AMOUNT_CHOICES),
			label: 'NIMBLE.rules.damageBack.amount.label',
			hint: 'NIMBLE.rules.damageBack.amount.hint',
		}),
		woundDoubles: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.damageBack.woundDoubles.label',
			hint: 'NIMBLE.rules.damageBack.woundDoubles.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'damageBack' }),
	};
}

declare namespace DamageBackRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When the owner takes damage from an attack, the one who attacked takes the
 * same amount, ignoring armor. Read on the GM client when the damage is applied.
 */
class DamageBackRule extends NimbleBaseRule<DamageBackRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.damageBack.description';

	declare onlyCrits: boolean;
	declare amount: (typeof AMOUNT_CHOICES)[number];
	declare woundDoubles: boolean;

	static override defineSchema(): DamageBackRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['onlyCrits', 'boolean'],
				['amount', 'string'],
				['woundDoubles', 'boolean'],
			]),
		);
	}

	/** Whether the rule answers damage from this attack. */
	answersAttack(attack: { isCritical: boolean }): boolean {
		if (!this.isOnActor || !this.test()) return false;
		return !this.onlyCrits || attack.isCritical;
	}
}

export { DamageBackRule };
