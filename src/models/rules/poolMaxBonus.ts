import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.poolMaxBonus.poolIdentifier.label',
				hint: 'NIMBLE.rules.poolMaxBonus.poolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		amount: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 1,
			integer: true,
			label: 'NIMBLE.rules.poolMaxBonus.amount.label',
			hint: 'NIMBLE.rules.poolMaxBonus.amount.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'poolMaxBonus' }),
	};
}

declare namespace PoolMaxBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Raises the maximum of a charge pool by a flat amount.
 *
 * The bonus is carried by the owned item, so a character who takes the same
 * option twice holds two items and gets twice the bonus. Removing the item
 * removes the bonus, which is what lets a pick be swapped or reverted without
 * a separate record of it existing anywhere else.
 *
 * The pool max is resolved in `getChargePoolDefinitions` rather than by a
 * preparation hook, because the pool a bonus names may be defined on another
 * item that has not been prepared yet.
 */
class PoolMaxBonusRule extends NimbleBaseRule<PoolMaxBonusRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.poolMaxBonus.description';

	// The base class infers this from the presence of a `prePrepareData` method.
	// This rule has none, but its predicate is read ahead of that sweep, so it
	// needs the early-phase predicate guardrails all the same.
	static override get appliesInPrePrepareData(): boolean {
		return true;
	}

	declare poolIdentifier: string;

	declare amount: number;

	static override defineSchema(): PoolMaxBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolIdentifier', 'string'],
				['amount', 'number'],
			]),
		);
	}

	/** Whether this rule raises the max of the named pool right now. */
	appliesToPool(identifier: string): boolean {
		if (this.poolIdentifier.trim() !== identifier) return false;
		if (!Number.isFinite(this.amount) || this.amount === 0) return false;
		return this.appliesTo();
	}
}

export { PoolMaxBonusRule };
