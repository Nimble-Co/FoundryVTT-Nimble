import { maximizePoolDie } from '#utils/dicePool/dicePoolRefill.js';
import { getPools } from '#utils/dicePool/dicePoolSync.js';
import { normalizeIdentifier } from '#utils/dicePool/helpers.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const TRIGGERS = ['onAttacked', 'onWound'] as const;

function schema() {
	const { fields } = foundry.data;
	return {
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.poolDieToMax.poolIdentifier.label',
				hint: 'NIMBLE.rules.poolDieToMax.poolIdentifier.hint',
				widget: 'dicePoolPicker',
			}),
		),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'onAttacked',
			choices: [...TRIGGERS],
			label: 'NIMBLE.rules.poolDieToMax.trigger.label',
			hint: 'NIMBLE.rules.poolDieToMax.trigger.hint',
		}),
		reach: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '0',
				widget: 'formula',
				label: 'NIMBLE.rules.poolDieToMax.reach.label',
				hint: 'NIMBLE.rules.poolDieToMax.reach.hint',
				showWhen: (data: Record<string, unknown>) => data.trigger === 'onWound',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'poolDieToMax' }),
	};
}

declare namespace PoolDieToMaxRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When the trigger fires, the lowest dice of a pool go to their max: one when the
 * hero is attacked, one per Wound on the hero or on an ally within the reach.
 */
class PoolDieToMaxRule extends NimbleBaseRule<PoolDieToMaxRule.Schema> {
	declare poolIdentifier: string;
	declare trigger: (typeof TRIGGERS)[number];
	declare reach: string;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.poolDieToMax.description';
	static override icon = 'fa-solid fa-arrow-up-9-1';

	static override defineSchema(): PoolDieToMaxRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolIdentifier', 'string'],
				['trigger', 'string'],
				['reach', 'string'],
			]),
		);
	}

	/** The spaces from the hero to a wounded ally; 0 is the hero only. */
	resolveReach(): number {
		return this.resolveSpaces(this.reach, 0);
	}

	/** Raise the lowest `count` dice of the pool. */
	async raiseDice(count: number): Promise<void> {
		const actor = this.actor;
		if (!actor || !this.isOnActor) return;
		const identifier = normalizeIdentifier(this.poolIdentifier);
		const pool = getPools(actor).find(
			(each) => normalizeIdentifier(each.identifier) === identifier,
		);
		if (pool) await maximizePoolDie(actor, pool.id, count);
	}
}

export { PoolDieToMaxRule };
