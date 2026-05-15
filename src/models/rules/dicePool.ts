import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { NimbleBaseRule } from './base.js';

const DICE_POOL_SCOPES = [...DicePoolRuleConfig.scopes];
const DICE_POOL_DIE_SIZES = [...DicePoolRuleConfig.dieSizes];
const DICE_POOL_INITIAL_VALUES = [...DicePoolRuleConfig.initialModes];
const DICE_REFILL_TRIGGERS = [...DicePoolRuleConfig.refillTriggers];
const DICE_REFILL_MODES = [...DicePoolRuleConfig.refillModes];
const DICE_CONSUMPTION_MODES = [...DicePoolRuleConfig.consumptionModes];
const DICE_ATTACK_DELIVERY_FILTERS = [...DicePoolRuleConfig.attackDeliveryFilters];

function schema() {
	const { fields } = foundry.data;

	return {
		scope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			choices: DICE_POOL_SCOPES,
		}),
		dieSize: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'd4',
			choices: DICE_POOL_DIE_SIZES,
		}),
		max: new fields.StringField({ required: true, nullable: false, initial: '1' }),
		initial: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'max',
			choices: DICE_POOL_INITIAL_VALUES,
		}),
		refills: new fields.ArrayField(
			new fields.SchemaField({
				trigger: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'safeRest',
					choices: DICE_REFILL_TRIGGERS,
				}),
				mode: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'add',
					choices: DICE_REFILL_MODES,
				}),
				value: new fields.StringField({ required: true, nullable: false, initial: '1' }),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
			},
		),
		// 'manual' (default) preserves the existing dialog-spend behavior:
		// the player opts in to each die, dice consumed after the roll.
		// 'autoBonus' adds every face to qualifying attacks automatically and
		// never consumes the pool (Fury Dice snowball semantics).
		consumption: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'manual',
			choices: DICE_CONSUMPTION_MODES,
		}),
		// Restricts autoBonus dice to attacks of this delivery. `null` means
		// no filter (auto-bonus applies to every attack roll). Ignored when
		// consumption === 'manual'.
		bonusOnAttackDelivery: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			choices: DICE_ATTACK_DELIVERY_FILTERS,
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'dicePool' }),
	};
}

declare namespace DicePoolRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class DicePoolRule extends NimbleBaseRule<DicePoolRule.Schema> {
	declare scope: (typeof DicePoolRuleConfig.scopes)[number];

	declare dieSize: (typeof DicePoolRuleConfig.dieSizes)[number];

	declare max: string;

	declare initial: (typeof DicePoolRuleConfig.initialModes)[number];

	declare consumption: (typeof DicePoolRuleConfig.consumptionModes)[number];

	declare bonusOnAttackDelivery: (typeof DicePoolRuleConfig.attackDeliveryFilters)[number] | null;

	static override defineSchema(): DicePoolRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['scope', '"item" | "actor"'],
				['dieSize', '"d4" | "d6" | "d8" | "d10" | "d12" | "d20"'],
				['max', 'string'],
				['initial', '"max" | "zero"'],
				['refills', 'Array<{ trigger: string; mode: string; value: string }>'],
				['consumption', '"manual" | "autoBonus"'],
				['bonusOnAttackDelivery', '"melee" | "ranged" | "any" | null'],
			]),
		);
	}
}

export { DicePoolRule };
