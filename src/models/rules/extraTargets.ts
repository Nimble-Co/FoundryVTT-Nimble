import { ruleLabel } from '../../utils/actor/actorRules.js';
import { isMadeThrough } from '../../utils/damage/attackOrigin.js';
import { attackOriginField } from './_attackOriginField.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		attackOrigin: attackOriginField(),
		count: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 1,
			min: 1,
			integer: true,
			label: 'NIMBLE.rules.extraTargets.count.label',
			hint: 'NIMBLE.rules.extraTargets.count.hint',
		}),
		reach: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: 'NIMBLE.rules.extraTargets.reach.label',
			hint: 'NIMBLE.rules.extraTargets.reach.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'extraTargets' }),
	};
}

declare namespace ExtraTargetsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** What an extra-targets rule gives an attack made through its item. */
interface ExtraTargets {
	/** What the line calls the rule: its label, or the name of its item. */
	source: string;
	count: number;
	/** The reach the extra targets are within, shown as text. 0 says no reach. */
	reach: number;
}

/**
 * An attack made through one item can target more creatures. The extra targets share
 * one attack: one roll, each target's armor, miss and crit as normal. The reach is
 * shown, not checked.
 */
class ExtraTargetsRule extends NimbleBaseRule<ExtraTargetsRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.extraTargets.description';
	static override icon = 'fa-solid fa-people-arrows';

	declare attackOrigin: string;
	declare count: number;
	declare reach: number;

	static override defineSchema(): ExtraTargetsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['attackOrigin', 'string'],
				['count', 'number'],
				['reach', 'number'],
			]),
		);
	}

	/** The extra targets of an attack made through the item with this identifier, or null. */
	extraTargetsFor(origin: string | null | undefined): ExtraTargets | null {
		if (!this.isOnActor || !this.test()) return null;
		if (!this.attackOrigin?.trim() || !origin || !isMadeThrough(this.attackOrigin, origin)) {
			return null;
		}
		return {
			source: ruleLabel(this),
			count: Math.max(1, Math.trunc(Number(this.count) || 1)),
			reach: Math.max(0, Math.trunc(Number(this.reach) || 0)),
		};
	}
}

export { type ExtraTargets, ExtraTargetsRule };
