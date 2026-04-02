import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'lionheartedBonus' }),
	};
}

declare namespace LionheartedBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class LionheartedBonusRule extends NimbleBaseRule<LionheartedBonusRule.Schema> {
	static override defineSchema(): LionheartedBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo();
	}
}

export { LionheartedBonusRule };
