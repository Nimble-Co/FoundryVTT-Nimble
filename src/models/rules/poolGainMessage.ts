import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		// The dice pool whose gains trigger the message.
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.poolGainMessage.poolIdentifier.label',
				hint: 'NIMBLE.rules.poolGainMessage.poolIdentifier.hint',
				widget: 'dicePoolPicker',
			}),
		),
		// Supports @-references (e.g. @dexterity). Use {value} in message to insert the result.
		formula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.poolGainMessage.formula.label',
				hint: 'NIMBLE.rules.poolGainMessage.formula.hint',
				widget: 'formula',
			}),
		),
		message: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.poolGainMessage.message.label',
				hint: 'NIMBLE.rules.poolGainMessage.message.hint',
				widget: 'templateString',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'poolGainMessage',
		}),
	};
}

declare namespace PoolGainMessageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Posts a chat reminder whenever the targeted dice pool GAINS dice. Passive
 * from the rules engine's perspective: a dedicated hook listener
 * (registerPoolGainMessageHooks) watches pool-changed events and resolves
 * matching rules on the owning actor.
 */
class PoolGainMessageRule extends NimbleBaseRule<PoolGainMessageRule.Schema> {
	static override group = 'notes';
	static override description = 'NIMBLE.rules.poolGainMessage.description';

	declare poolIdentifier: string;
	declare formula: string;
	declare message: string;

	static override defineSchema(): PoolGainMessageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolIdentifier', 'string'],
				['formula', 'string'],
				['message', 'string'],
			]),
		);
	}

	resolveMessage(): string {
		const value = this.resolveFormula(this.formula) ?? 0;
		return this.message.replaceAll('{value}', String(value));
	}
}

export { PoolGainMessageRule };
