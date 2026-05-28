import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const DICE_CONSUMER_SCOPES = [...DicePoolRuleConfig.scopes];
const DICE_CONSUMER_MODES = [...DicePoolRuleConfig.consumptionModes];
const DICE_ATTACK_DELIVERY_FILTERS = [...DicePoolRuleConfig.attackDeliveryFilters];

function schema() {
	const { fields } = foundry.data;

	return {
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				widget: 'dicePoolPicker',
			}),
		),
		poolScope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			choices: DICE_CONSUMER_SCOPES,
		}),
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'manual',
			choices: DICE_CONSUMER_MODES,
		}),
		cost: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				widget: 'formula',
			}),
		),
		bonusOnAttackDelivery: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			choices: DICE_ATTACK_DELIVERY_FILTERS,
		}),
		effectFormula: new fields.StringField(
			withWidget({
				required: false,
				nullable: true,
				initial: null,
				widget: 'formula',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'diceConsumer',
		}),
	};
}

declare namespace DiceConsumerRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class DiceConsumerRule extends NimbleBaseRule<DiceConsumerRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.diceConsumer.description';

	declare poolIdentifier: string;

	declare poolScope: (typeof DicePoolRuleConfig.scopes)[number];

	declare mode: (typeof DicePoolRuleConfig.consumptionModes)[number];

	declare cost: string;

	declare bonusOnAttackDelivery: (typeof DicePoolRuleConfig.attackDeliveryFilters)[number] | null;

	declare effectFormula: string | null;

	static override defineSchema(): DiceConsumerRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolIdentifier', 'string'],
				['poolScope', '"item" | "actor"'],
				['mode', '"manual" | "autoBonus"'],
				['cost', 'string'],
				['bonusOnAttackDelivery', '"melee" | "ranged" | "any" | null'],
				['effectFormula', 'string | null'],
			]),
		);
	}
}

export { DiceConsumerRule };
