import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { NimbleBaseRule } from './base.js';

const DICE_POOL_DIE_SIZES = [...DicePoolRuleConfig.dieSizes];

function schema() {
	const { fields } = foundry.data;

	return {
		poolIdentifier: new fields.StringField({ required: true, nullable: false, initial: '' }),
		dieSize: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			choices: DICE_POOL_DIE_SIZES,
		}),
		maxDelta: new fields.StringField({ required: false, nullable: true, initial: null }),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'modifyDicePool',
		}),
	};
}

declare namespace ModifyDicePoolRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ModifyDicePoolRule extends NimbleBaseRule<ModifyDicePoolRule.Schema> {
	declare poolIdentifier: string;

	declare dieSize: (typeof DicePoolRuleConfig.dieSizes)[number] | null;

	declare maxDelta: string | null;

	static override defineSchema(): ModifyDicePoolRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolIdentifier', 'string'],
				['dieSize', '"d4" | "d6" | "d8" | "d10" | "d12" | "d20" | null'],
				['maxDelta', 'string | null'],
			]),
		);
	}
}

export { ModifyDicePoolRule };
