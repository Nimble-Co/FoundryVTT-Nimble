import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const EFFECT_TYPE_FILTERS = ['', ...DicePoolRuleConfig.effectTypes] as const;
const MODIFY_CONSUMER_SCOPES = [...DicePoolRuleConfig.scopes];

function schema() {
	const { fields } = foundry.data;

	return {
		// Matches diceConsumer rules across the actor that target this pool
		// identifier. Lets one item's rule augment a consumer defined on
		// another (or the same) item.
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.modifyConsumer.poolIdentifier.label',
				hint: 'NIMBLE.rules.modifyConsumer.poolIdentifier.hint',
				widget: 'dicePoolPicker',
			}),
		),
		// Identifiers are only unique within a scope, so this must match the
		// target pool's scope as well or an item-scoped and an actor-scoped pool
		// sharing an identifier would cross-contaminate.
		poolScope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			label: 'NIMBLE.rules.modifyConsumer.poolScope.label',
			hint: 'NIMBLE.rules.modifyConsumer.poolScope.hint',
			choices: MODIFY_CONSUMER_SCOPES,
		}),
		// Restrict the modification to consumers with a specific effect type.
		// Blank matches every consumer on the pool.
		effectTypeFilter: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.modifyConsumer.effectTypeFilter.label',
			hint: 'NIMBLE.rules.modifyConsumer.effectTypeFilter.hint',
			choices: [...EFFECT_TYPE_FILTERS] as string[],
		}),
		// Appended to the matching consumers' effect formula as "+ (…)". The
		// spend context tokens (@n, @sum) are available in addition to actor
		// roll data.
		appendFormula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.modifyConsumer.appendFormula.label',
				hint: 'NIMBLE.rules.modifyConsumer.appendFormula.hint',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'modifyConsumer',
		}),
	};
}

declare namespace ModifyConsumerRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Passive data rule that augments the effect formula of diceConsumer rules
 * targeting the same pool. It implements no lifecycle hooks of its own;
 * consumer enumeration (`getDicePoolConsumers`) consults matching
 * modifyConsumer rules on the owning actor and appends `appendFormula` to
 * each matching consumer's effect formula.
 */
class ModifyConsumerRule extends NimbleBaseRule<ModifyConsumerRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.modifyConsumer.description';

	declare poolIdentifier: string;

	declare poolScope: (typeof DicePoolRuleConfig.scopes)[number];

	declare effectTypeFilter: string;

	declare appendFormula: string;

	static override defineSchema(): ModifyConsumerRule.Schema {
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
				['effectTypeFilter', '"" | "generic" | "damageReduction"'],
				['appendFormula', 'string'],
			]),
		);
	}
}

export { ModifyConsumerRule };
