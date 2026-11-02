import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		flat: new fields.StringField({
			required: true,
			nullable: false,
			initial: '0',
			label: 'NIMBLE.rules.surgeMana.flat.label',
			hint: 'NIMBLE.rules.surgeMana.flat.hint',
		}),
		dice: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.surgeMana.dice.label',
			hint: 'NIMBLE.rules.surgeMana.dice.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'surgeMana' }),
	};
}

declare namespace SurgeManaRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rolling Initiative gives mana that ends with the combat. The dice show on the
 * Initiative card. With Feature Effects off, a button on the card gives the mana.
 */
class SurgeManaRule extends NimbleBaseRule<SurgeManaRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.surgeMana.description';

	static override defineSchema(): SurgeManaRule.Schema {
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

function rerollSchema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'surgeRerollOnes' }),
	};
}

declare namespace SurgeRerollOnesRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof rerollSchema>;
}

/** Each 1 on a surge die rolls again one time. */
class SurgeRerollOnesRule extends NimbleBaseRule<SurgeRerollOnesRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.surgeRerollOnes.description';

	static override defineSchema(): SurgeRerollOnesRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...rerollSchema(),
		};
	}

	/** The feature name for the tag. Null when its condition does not hold. */
	get rerollFeature(): string | null {
		if (!this.item.isEmbedded || !this.test()) return null;
		return this.label || this.item.name || '';
	}
}

export { SurgeManaRule, SurgeRerollOnesRule };
