import { ChargePoolRuleConfig } from '#utils/chargePool/chargePoolRuleConfig.js';
import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { PredicateField } from '../fields/PredicateField.js';
import { poolModeChoices, poolTriggerChoices } from './_poolChoices.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const POOL_TYPES = ['dice', 'charge'] as const;

// Both subsystems use the same die-size vocabulary today. Union the lists so
// the rule schema reflects every valid choice, regardless of pool type.
const DIE_SIZES = Array.from(
	new Set<string>([...DicePoolRuleConfig.dieSizes, ...ChargePoolRuleConfig.dieSizes]),
);

// One modifier serves both pool types, so the stored trigger and mode lists are
// the union of both; the builder offers only the target pool type's entries.
// Both subsystems drop a contributed entry whose trigger or mode they do not
// implement, so a mismatched stored pick contributes nothing.
const REFILL_TRIGGERS = poolTriggerChoices(
	Array.from(
		new Set<string>([
			...DicePoolRuleConfig.refillTriggers,
			...ChargePoolRuleConfig.recoveryTriggers,
		]),
	),
);
const REFILL_MODES = poolModeChoices(DicePoolRuleConfig.refillModes);

const OFFERED_BY_POOL_TYPE = {
	dice: { triggers: DicePoolRuleConfig.refillTriggers, modes: DicePoolRuleConfig.refillModes },
	charge: {
		triggers: ChargePoolRuleConfig.recoveryTriggers,
		modes: ChargePoolRuleConfig.recoveryModes,
	},
} as const;

const offeredFor = (rule: Record<string, unknown>) =>
	OFFERED_BY_POOL_TYPE[rule.poolType === 'charge' ? 'charge' : 'dice'];

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
				// The picker follows `poolType`: dice pools and charge pools are
				// separate subsystems with separate identifier namespaces, so the
				// wrong picker lists nothing and flags the stored value as missing.
				widget: (data: Record<string, unknown>) =>
					data.poolType === 'charge' ? 'chargePoolPicker' : 'dicePoolPicker',
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
		// Entries this modifier contributes to the target pool: refills on a dice
		// pool, recoveries on a charge pool. Lets a granting feature add its own
		// trigger without editing the base pool rule.
		addRefills: new fields.ArrayField(
			new fields.SchemaField({
				trigger: new fields.StringField(
					withWidget({
						required: true,
						nullable: false,
						initial: 'safeRest',
						label: 'NIMBLE.rules.dicePool.refills.trigger.label',
						hint: 'NIMBLE.rules.dicePool.refills.trigger.hint',
						choices: REFILL_TRIGGERS,
						choicesFor: (rule: Record<string, unknown>) => offeredFor(rule).triggers,
					}),
				),
				mode: new fields.StringField(
					withWidget({
						required: true,
						nullable: false,
						initial: 'add',
						label: 'NIMBLE.rules.dicePool.refills.mode.label',
						hint: 'NIMBLE.rules.modifyPool.addRefills.mode.hint',
						choices: REFILL_MODES,
						choicesFor: (rule: Record<string, unknown>) => offeredFor(rule).modes,
					}),
				),
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
				temporary: new fields.BooleanField({
					required: false,
					nullable: false,
					initial: false,
					label: 'NIMBLE.rules.chargePool.recoveries.temporary.label',
					hint: 'NIMBLE.rules.chargePool.recoveries.temporary.hint',
				}),
				notWhenSpent: new fields.BooleanField({
					required: false,
					nullable: false,
					initial: false,
					label: 'NIMBLE.rules.chargePool.recoveries.notWhenSpent.label',
					hint: 'NIMBLE.rules.chargePool.recoveries.notWhenSpent.hint',
				}),
				needsFeatureEffects: new fields.BooleanField({
					required: false,
					nullable: false,
					initial: false,
					label: 'NIMBLE.rules.chargePool.recoveries.needsFeatureEffects.label',
					hint: 'NIMBLE.rules.chargePool.recoveries.needsFeatureEffects.hint',
				}),
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
	static override worksOnEffects = false;

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
