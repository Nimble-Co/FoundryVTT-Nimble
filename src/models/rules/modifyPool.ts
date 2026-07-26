import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { PredicateField } from '../fields/PredicateField.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const POOL_TYPES = ['dice', 'charge'] as const;

// Both subsystems use the same die-size vocabulary today. Union the lists so
// the rule schema reflects every valid choice, regardless of pool type.
const DIE_SIZES = Array.from(
	new Set<string>([...DicePoolRuleConfig.dieSizes, ...ChargePoolRuleConfig.dieSizes]),
);

type PoolType = (typeof POOL_TYPES)[number];

function schema() {
	const { fields } = foundry.data;

	return {
		poolType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'dice',
			label: 'NIMBLE.rules.modifyPool.poolType.label',
			hint: 'NIMBLE.rules.modifyPool.poolType.hint',
			choices: [...POOL_TYPES] as string[],
		}),
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.modifyPool.poolIdentifier.label',
				hint: 'NIMBLE.rules.modifyPool.poolIdentifier.hint',
				// modifyPool can target either a dice or charge pool (`poolType`
				// switches between them). The widget catalog has no conditional-
				// widget primitive yet, so default to the dice picker — the more
				// common case — and let authors fall back to typing for charge
				// pools (the stored value is a plain string regardless).
				widget: 'dicePoolPicker',
			}),
		),
		dieSize: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			label: 'NIMBLE.rules.modifyPool.dieSize.label',
			hint: 'NIMBLE.rules.modifyPool.dieSize.hint',
			choices: DIE_SIZES,
		}),
		maxDelta: new fields.StringField(
			withWidget({
				required: false,
				nullable: true,
				initial: null,
				label: 'NIMBLE.rules.modifyPool.maxDelta.label',
				hint: 'NIMBLE.rules.modifyPool.maxDelta.hint',
				widget: 'formula',
			}),
		),
		// Minimum face value for dice rolled into the target pool (dice pools
		// only). Rolls below the floor are raised to it. The highest floor
		// among contributing modifiers wins.
		minFace: new fields.NumberField({
			required: false,
			nullable: true,
			initial: null,
			integer: true,
			min: 1,
			label: 'NIMBLE.rules.modifyPool.minFace.label',
			hint: 'NIMBLE.rules.modifyPool.minFace.hint',
		}),
		// Refill entries this modifier contributes to the target pool (dice pools
		// only). Lets a granting feature add its own refill trigger without
		// editing the base pool rule.
		addRefills: new fields.ArrayField(
			new fields.SchemaField({
				trigger: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'safeRest',
					label: 'NIMBLE.rules.dicePool.refills.trigger.label',
					hint: 'NIMBLE.rules.dicePool.refills.trigger.hint',
					choices: [...DicePoolRuleConfig.refillTriggers],
				}),
				mode: new fields.StringField({
					required: true,
					nullable: false,
					initial: 'add',
					label: 'NIMBLE.rules.dicePool.refills.mode.label',
					hint: 'NIMBLE.rules.dicePool.refills.mode.hint',
					choices: [...DicePoolRuleConfig.refillModes],
				}),
				value: new fields.StringField(
					withWidget({
						required: true,
						nullable: false,
						initial: '1',
						label: 'NIMBLE.rules.dicePool.refills.value.label',
						hint: 'NIMBLE.rules.dicePool.refills.value.hint',
						widget: 'formula',
					}),
				),
				// Cast: PredicateField extends ObjectField whose constructor typing
				// doesn't accept label/hint. The renderer reads them off the instance.
				predicate: new PredicateField({
					label: 'NIMBLE.rules.dicePool.refills.predicate.label',
					hint: 'NIMBLE.rules.dicePool.refills.predicate.hint',
				} as unknown as never),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.modifyPool.addRefills.label',
				hint: 'NIMBLE.rules.modifyPool.addRefills.hint',
			} as unknown as never,
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'modifyPool',
		}),
	};
}

declare namespace ModifyPoolRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ModifyPoolRule extends NimbleBaseRule<ModifyPoolRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.modifyPool.description';

	declare poolType: PoolType;

	declare poolIdentifier: string;

	declare dieSize: string | null;

	declare maxDelta: string | null;

	declare minFace: number | null;

	// `addRefills` is intentionally not re-declared: the schema-inferred type
	// (with its exact choice unions) is used as-is, mirroring dicePool.refills.

	static override defineSchema(): ModifyPoolRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolType', '"dice" | "charge"'],
				['poolIdentifier', 'string'],
				['dieSize', '"d4" | "d6" | "d8" | "d10" | "d12" | "d20" | null'],
				['maxDelta', 'string | null'],
				['minFace', 'number | null'],
				[
					'addRefills',
					'Array<{ trigger: string; mode: string; value: string; predicate: object }>',
				],
			]),
		);
	}
}

export { ModifyPoolRule, type PoolType };
