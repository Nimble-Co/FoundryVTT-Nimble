import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'additionalMark' }),
		flagKey: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'quarry',
			label: 'NIMBLE.rules.additionalMark.flagKey.label',
			hint: 'NIMBLE.rules.additionalMark.flagKey.hint',
		}),
		within: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 1,
			initial: 6,
			label: 'NIMBLE.rules.additionalMark.within.label',
			hint: 'NIMBLE.rules.additionalMark.within.hint',
		}),
	};
}

declare namespace AdditionalMarkRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * After a mark that ends every earlier mark of the same flag, offer one more creature
 * within `within` spaces of the new mark. The mark rule asks; this rule only says
 * whether to offer, and for which flag. Accepting marks that creature too and does
 * not use an item, so it spends no action and no charges.
 */
class AdditionalMarkRule extends NimbleBaseRule<AdditionalMarkRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.additionalMark.description';
	static override icon = 'fa-solid fa-crosshairs';

	declare flagKey: string;
	declare within: number;

	static override defineSchema(): AdditionalMarkRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['flagKey', 'string'],
				['within', 'number'],
			]),
		);
	}
}

export { AdditionalMarkRule };
