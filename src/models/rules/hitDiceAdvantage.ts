import { NimbleBaseRule } from './base.js';

/** Roll contexts a hit-dice advantage rule can apply to. */
const ROLL_CONTEXTS = ['fieldRest', 'maxHpIncrease'] as const;

function schema() {
	const { fields } = foundry.data;

	return {
		// User-facing condition text (e.g., "in the wild", "underground", etc.)
		condition: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.hitDiceAdvantage.condition.label',
			hint: 'NIMBLE.rules.hitDiceAdvantage.condition.hint',
		}),
		// Advantage level. 1 = normal advantage (roll 2, keep highest); 2 = advantage 2
		// (roll 3, keep highest); etc. The number of dice rolled is `amount + 1`.
		amount: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 1,
			integer: true,
			min: 1,
			label: 'NIMBLE.rules.hitDiceAdvantage.amount.label',
			hint: 'NIMBLE.rules.hitDiceAdvantage.amount.hint',
		}),
		// Which hit-dice roll the advantage applies to. `fieldRest` covers the
		// healing rolls made during a field rest; `maxHpIncrease` covers the
		// roll made to increase max HP when leveling up.
		rollContext: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'fieldRest',
			choices: [...ROLL_CONTEXTS],
			label: 'NIMBLE.rules.hitDiceAdvantage.rollContext.label',
			hint: 'NIMBLE.rules.hitDiceAdvantage.rollContext.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'hitDiceAdvantage' }),
	};
}

declare namespace HitDiceAdvantageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class HitDiceAdvantageRule extends NimbleBaseRule<HitDiceAdvantageRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.hitDiceAdvantage.description';

	declare condition: string;

	declare amount: number;

	declare rollContext: 'fieldRest' | 'maxHpIncrease';

	static override defineSchema(): HitDiceAdvantageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['condition', 'string'],
				['amount', 'number'],
				[
					'rollContext',
					"'fieldRest' <span class=\"nimble-type-summary__operator\">|</span> 'maxHpIncrease'",
				],
			]),
		);
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;
		if (actor.type !== 'character') return;

		if (!this.test()) return;

		// Store the advantage rule for display in the rest dialog and for use
		// during the max-HP-increase roll on level up.
		const advantageRules = (foundry.utils.getProperty(
			actor.system,
			'attributes.hitDiceAdvantageRules',
		) ?? []) as Array<{
			id: string;
			label: string;
			condition: string;
			amount: number;
			rollContext: string;
			sourceId: string;
		}>;

		advantageRules.push({
			id: this.id,
			label: this.label,
			condition: this.condition,
			amount: this.amount,
			rollContext: this.rollContext,
			sourceId: item.sourceId ?? item.uuid,
		});

		foundry.utils.setProperty(actor.system, 'attributes.hitDiceAdvantageRules', advantageRules);
	}
}

export { HitDiceAdvantageRule };
