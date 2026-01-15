import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '1' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'incrementHitDice' }),
	};
}

declare namespace IncrementHitDiceRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class IncrementHitDiceRule extends NimbleBaseRule<IncrementHitDiceRule.Schema> {
	declare value: string;

	static override defineSchema(): IncrementHitDiceRule.Schema {
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

		const { actor } = item;
		if (actor.type !== 'character') return;

		if (!this.test()) return;

		const value = this.resolveFormula(this.value) ?? 0;

		// Get current bonus and add to it
		const currentBonus = (foundry.utils.getProperty(actor.system, 'attributes.hitDiceSizeBonus') ??
			0) as number;
		const newBonus = currentBonus + value;

		foundry.utils.setProperty(actor.system, 'attributes.hitDiceSizeBonus', newBonus);

		// Store contribution for display purposes
		const contributions = (foundry.utils.getProperty(
			actor.system,
			'attributes.hitDiceSizeBonusContributions',
		) ?? []) as Array<{ label: string; value: number }>;
		contributions.push({ label: this.label, value });
		foundry.utils.setProperty(
			actor.system,
			'attributes.hitDiceSizeBonusContributions',
			contributions,
		);
	}
}

export { IncrementHitDiceRule };
