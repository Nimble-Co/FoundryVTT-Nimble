import type { NimbleCharacter } from '../../documents/actor/character.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.healingPotionBonus.value.label',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'healingPotionBonus',
		}),
	};
}

declare namespace HealingPotionBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class HealingPotionBonusRule extends NimbleBaseRule<HealingPotionBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.healingPotionBonus.description';

	static override defineSchema(): HealingPotionBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const actor = item.actor as NimbleCharacter;
		const value = this.resolveFormula(this.value) ?? 0;

		// Store the bonus on the actor for use during item activation
		const currentBonus = (actor.system as { healingPotionBonus?: number }).healingPotionBonus ?? 0;
		foundry.utils.setProperty(actor.system, 'healingPotionBonus', currentBonus + value);
	}
}

export { HealingPotionBonusRule };
