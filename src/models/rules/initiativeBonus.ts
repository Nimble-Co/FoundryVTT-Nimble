import { NimbleBaseRule } from './base';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'initiativeBonus' }),
	};
}

declare namespace InitiativeBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class InitiativeBonusRule extends NimbleBaseRule<InitiativeBonusRule.Schema> {
	static override defineSchema(): InitiativeBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;
		const value = this.resolveFormula(this.value) ?? 0;
		const originalValue = actor.system.attributes.initiative.mod ?? 0;
		const modifiedValue = originalValue + value;

		foundry.utils.setProperty(actor.system, 'attributes.initiative.mod', modifiedValue);
	}
}

export { InitiativeBonusRule };
