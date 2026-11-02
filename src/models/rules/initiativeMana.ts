import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		flat: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '0',
				label: 'NIMBLE.rules.initiativeMana.flat.label',
				hint: 'NIMBLE.rules.initiativeMana.flat.hint',
				widget: 'formula',
			}),
		),
		dice: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.initiativeMana.dice.label',
				hint: 'NIMBLE.rules.initiativeMana.dice.hint',
				widget: 'diceFormula',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'initiativeMana' }),
	};
}

declare namespace InitiativeManaRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rolling Initiative gives mana that ends with the combat. The dice show on the
 * Initiative card. With Feature Effects off, a button on the card gives the mana.
 */
class InitiativeManaRule extends NimbleBaseRule<InitiativeManaRule.Schema> {
	declare flat: string;
	declare dice: string;

	static override group = 'resource';
	static override description = 'NIMBLE.rules.initiativeMana.description';

	static override defineSchema(): InitiativeManaRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['flat', 'string'],
				['dice', 'string'],
			]),
		);
	}

	/** What the rule gives now. Null when its condition does not hold. */
	get surgeSpec(): { feature: string; flat: number; dice: string } | null {
		if (!this.item.isEmbedded || !this.test()) return null;
		return {
			feature: this.label || this.item.name || '',
			flat: Math.max(0, Math.trunc(Number(this.resolveFormula(this.flat)) || 0)),
			dice: (this.dice ?? '').trim(),
		};
	}
}

export { InitiativeManaRule };
