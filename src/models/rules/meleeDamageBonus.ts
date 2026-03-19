import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({
			required: true,
			nullable: false,
			initial: '@level',
		}),
		damageType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'bludgeoning',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'meleeDamageBonus' }),
	};
}

declare namespace MeleeDamageBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that adds bonus damage to all melee attacks.
 * The bonus is stored on the actor and applied during item activation.
 */
class MeleeDamageBonusRule extends NimbleBaseRule<MeleeDamageBonusRule.Schema> {
	declare value: string;
	declare damageType: string;

	static override defineSchema(): MeleeDamageBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['damageType', 'string'],
			]),
		);
	}

	/**
	 * Apply the melee damage bonus to the actor.
	 * The bonus is stored and later applied by ItemActivationManager.
	 */
	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const { actor } = item;
		const resolvedValue = this.resolveFormula(this.value);

		// Store the bonus on the actor for use during item activation
		foundry.utils.setProperty(actor.system, 'meleeDamageBonus', {
			value: resolvedValue,
			damageType: this.damageType,
		});
	}
}

export { MeleeDamageBonusRule };
