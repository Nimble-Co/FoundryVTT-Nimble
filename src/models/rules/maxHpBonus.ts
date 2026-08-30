import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			label: 'NIMBLE.rules.maxHpBonus.value.label',
			hint: 'NIMBLE.rules.maxHpBonus.value.hint',
		}),
		perLevel: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.maxHpBonus.perLevel.label',
			hint: 'NIMBLE.rules.maxHpBonus.perLevel.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxHpBonus' }),
	};
}

declare namespace MaxHpBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class MaxHpBonusRule extends NimbleBaseRule<MaxHpBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.maxHpBonus.description';

	// The base class infers this from the presence of a `prePrepareData` method.
	// This rule has none, but is read even earlier than that sweep, so it needs
	// the early-phase predicate guardrails all the same.
	static override get appliesInPrePrepareData(): boolean {
		return true;
	}

	declare value: number;
	declare perLevel: boolean;

	static override defineSchema(): MaxHpBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['perLevel', 'boolean'],
			]),
		);
	}

	/**
	 * The max-HP this rule currently contributes. Resolved on demand rather than
	 * banked into the stored `attributes.hp.bonus`, where it went stale as soon
	 * as anything the formula reads changed and could not be reconciled after
	 * the fact.
	 */
	resolvedBonus(): number {
		const { item } = this;
		if (!item?.isEmbedded) return 0;
		if (!this.test()) return 0;

		const formula = this.perLevel ? `${this.value} * @level` : `${this.value}`;

		return this.resolveFormula(formula) ?? 0;
	}
}

export { MaxHpBonusRule };
