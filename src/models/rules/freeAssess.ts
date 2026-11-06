import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: false,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.freeAssess.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.freeAssess.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'freeAssess' }),
	};
}

declare namespace FreeAssessRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Using the item opens Assess, free and with advantage. It spends a charge
 * when there is one. With none, it costs nothing.
 */
class FreeAssessRule extends NimbleBaseRule<FreeAssessRule.Schema> {
	declare chargePoolIdentifier: string;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.freeAssess.description';
	static override icon = 'fa-solid fa-magnifying-glass';

	static override defineSchema(): FreeAssessRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['chargePoolIdentifier', 'string']]));
	}

	protected override _autoSuppressesActivationCard(): boolean {
		return true;
	}
}

export { FreeAssessRule };
