import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
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
		poolIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.modifyPool.poolIdentifier.label',
			hint: 'NIMBLE.rules.modifyPool.poolIdentifier.hint',
		}),
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
			]),
		);
	}
}

export { ModifyPoolRule, type PoolType };
