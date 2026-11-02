import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'invokeChaos' }),
	};
}

declare namespace InvokeChaosRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * The spell dialog has a tick for 1 less mana. The tick or a crit rolls on the
 * Chaos Table. The system shows the text of the table, and applies no effect.
 */
class InvokeChaosRule extends NimbleBaseRule<InvokeChaosRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.invokeChaos.description';

	static override defineSchema(): InvokeChaosRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	get invokesChaos(): boolean {
		return this.item.isEmbedded && this.test();
	}
}

function optionsSchema() {
	const { fields } = foundry.data;
	return {
		rollTwice: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.chaosOptions.rollTwice.label',
			hint: 'NIMBLE.rules.chaosOptions.rollTwice.hint',
		}),
		chooseChargePool: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.chaosOptions.chooseChargePool.label',
				hint: 'NIMBLE.rules.chaosOptions.chooseChargePool.hint',
				widget: 'chargePoolPicker',
				showWhen: (data: Record<string, unknown>) => data.rollTwice === true,
			}),
		),
		advantage: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.chaosOptions.advantage.label',
			hint: 'NIMBLE.rules.chaosOptions.advantage.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'chaosOptions' }),
	};
}

declare namespace ChaosOptionsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof optionsSchema>;
}

/** What a Chaos Table roll can do: roll twice, choose with a use, or roll with advantage. */
class ChaosOptionsRule extends NimbleBaseRule<ChaosOptionsRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.chaosOptions.description';

	static override defineSchema(): ChaosOptionsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...optionsSchema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['rollTwice', 'boolean'],
				['chooseChargePool', 'string'],
				['advantage', 'boolean'],
			]),
		);
	}

	get applies(): boolean {
		return this.item.isEmbedded && this.test();
	}
}

export { ChaosOptionsRule, InvokeChaosRule };
