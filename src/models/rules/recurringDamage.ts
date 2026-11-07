import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule, type TurnContext } from './base.js';

const RECURRING_DAMAGE_TRIGGERS = ['turnStart', 'turnEnd'] as const;

type RecurringDamageTrigger = (typeof RECURRING_DAMAGE_TRIGGERS)[number];

function schema() {
	const { fields } = foundry.data;

	return {
		formula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.recurringDamage.formula.label',
				hint: 'NIMBLE.rules.recurringDamage.formula.hint',
				widget: 'formula',
			}),
		),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'turnStart',
			choices: RECURRING_DAMAGE_TRIGGERS as unknown as string[],
			label: 'NIMBLE.rules.recurringDamage.trigger.label',
			hint: 'NIMBLE.rules.recurringDamage.trigger.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'recurringDamage' }),
	};
}

declare namespace RecurringDamageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that damages the owning actor every turn, on a cadence no duration expresses: the damage
 * a creature takes for being on fire, or inside something.
 *
 * The roll is posted to chat before it is applied so the table can see where the damage came from.
 */
class RecurringDamageRule extends NimbleBaseRule<RecurringDamageRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.recurringDamage.description';

	declare formula: string;
	declare trigger: RecurringDamageTrigger;

	static override defineSchema(): RecurringDamageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['formula', 'string'],
				['trigger', 'string'],
			]),
		);
	}

	override async onTurnStart(context: TurnContext): Promise<void> {
		if (this.trigger !== 'turnStart') return;
		await this.#applyRecurringDamage(context);
	}

	override async onTurnEnd(context: TurnContext): Promise<void> {
		if (this.trigger !== 'turnEnd') return;
		await this.#applyRecurringDamage(context);
	}

	async #applyRecurringDamage(context: TurnContext): Promise<void> {
		if (context.actor !== this.item.actor) return;
		if (!this.formula.trim()) return;
		if (!this.test()) return;

		const actor = this.item.actor as unknown as {
			getRollData(): Record<string, unknown>;
			applyDamage(damage: number): Promise<void>;
		} | null;
		if (!actor) return;

		const roll = new Roll(this.formula, actor.getRollData());
		await roll.evaluate();

		const damage = Math.max(0, Math.floor(roll.total ?? 0));
		if (damage === 0) return;

		await roll.toMessage({
			flavor: this.label || this.item.name,
			speaker: { actor: actor as never },
		});
		await actor.applyDamage(damage);
	}
}

export { RecurringDamageRule, RECURRING_DAMAGE_TRIGGERS, type RecurringDamageTrigger };
