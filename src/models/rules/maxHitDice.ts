import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		dieSize: new fields.NumberField({ required: true, nullable: false, initial: 6 }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxHitDice' }),
	};
}

declare namespace MaxHitDiceRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class MaxHitDiceRule extends NimbleBaseRule<MaxHitDiceRule.Schema> {
	declare dieSize: number;

	declare value: string;

	static override defineSchema(): MaxHitDiceRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['dieSize', 'number'],
				['value', 'string'],
			]),
		);
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;
		if (actor.type !== 'character') return;

		const { dieSize } = this;
		const value = this.resolveFormula(this.value) ?? 0;

		const hitDiceData = (foundry.utils.getProperty(actor.system, `attributes.hitDice.${dieSize}`) ??
			{}) as { bonus?: number; origin?: string[] };

		const modifiedValue = (hitDiceData.bonus ?? 0) + value;
		foundry.utils.setProperty(actor.system, `attributes.hitDice.${dieSize}.bonus`, modifiedValue);
		foundry.utils.setProperty(actor.system, `attributes.hitDice.${dieSize}.origin`, [
			...(hitDiceData.origin ?? []),
			this.label,
		]);
	}
}

export { MaxHitDiceRule };
