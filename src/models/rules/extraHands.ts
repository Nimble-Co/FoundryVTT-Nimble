import { EXTRA_HANDS_PATH } from '#utils/weaponHands.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.extraHands.value.label',
				hint: 'NIMBLE.rules.extraHands.value.hint',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'extraHands' }),
	};
}

declare namespace ExtraHandsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ExtraHandsRule extends NimbleBaseRule<ExtraHandsRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.extraHands.description';

	declare value: string;

	static override defineSchema(): ExtraHandsRule.Schema {
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
		if (!this.test()) return;

		const { actor } = item;
		const current = (foundry.utils.getProperty(actor.system, EXTRA_HANDS_PATH) as number) ?? 0;
		foundry.utils.setProperty(
			actor.system,
			EXTRA_HANDS_PATH,
			current + (this.resolveFormula(this.value) ?? 0),
		);
	}
}

export { ExtraHandsRule };
