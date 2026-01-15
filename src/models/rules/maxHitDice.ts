import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		// dieSize of 0 means "use the character's class hit die size"
		dieSize: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
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

		// If dieSize is 0, use the character's class hit die size
		let dieSize = this.dieSize;
		if (dieSize === 0) {
			// Get class items to find the hit die size
			const classItems = actor.items.filter((i: Item) => i.type === 'class') as unknown as Array<{
				system: { hitDieSize: number };
			}>;
			if (classItems.length > 0) {
				dieSize = classItems[0].system.hitDieSize;
			} else {
				// No class found, default to d6
				dieSize = 6;
			}
		}

		const value = this.resolveFormula(this.value) ?? 0;

		const hitDiceData = (foundry.utils.getProperty(actor.system, `attributes.hitDice.${dieSize}`) ??
			{}) as { bonus?: number; contributions?: Array<{ label: string; value: number }> };

		const modifiedValue = (hitDiceData.bonus ?? 0) + value;
		foundry.utils.setProperty(actor.system, `attributes.hitDice.${dieSize}.bonus`, modifiedValue);

		// Store each rule's contribution separately for display purposes
		const contributions = hitDiceData.contributions ?? [];
		contributions.push({ label: this.label, value });
		foundry.utils.setProperty(
			actor.system,
			`attributes.hitDice.${dieSize}.contributions`,
			contributions,
		);
	}
}

export { MaxHitDiceRule };
