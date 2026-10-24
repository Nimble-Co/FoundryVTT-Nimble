import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type IncomingAttackModifier = 'disadvantage' | 'redirectToSelf' | 'autoMiss' | 'raiseMissThreshold';

function schema() {
	const { fields } = foundry.data;

	return {
		modifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'disadvantage',
			choices: {
				disadvantage: 'NIMBLE.rules.modifyIncomingAttack.modifiers.disadvantage',
				redirectToSelf: 'NIMBLE.rules.modifyIncomingAttack.modifiers.redirectToSelf',
				autoMiss: 'NIMBLE.rules.modifyIncomingAttack.modifiers.autoMiss',
				raiseMissThreshold: 'NIMBLE.rules.modifyIncomingAttack.modifiers.raiseMissThreshold',
			},
			label: 'NIMBLE.rules.modifyIncomingAttack.modifier.label',
			hint: 'NIMBLE.rules.modifyIncomingAttack.modifier.hint',
		}),
		range: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 2,
				min: 1,
				integer: true,
				label: 'NIMBLE.rules.modifyIncomingAttack.range.label',
				hint: 'NIMBLE.rules.modifyIncomingAttack.range.hint',
				showWhen: (data: Record<string, unknown>) => data.modifier === 'redirectToSelf',
			}),
		),
		missThreshold: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 2,
				min: 2,
				integer: true,
				label: 'NIMBLE.rules.modifyIncomingAttack.missThreshold.label',
				hint: 'NIMBLE.rules.modifyIncomingAttack.missThreshold.hint',
				showWhen: (data: Record<string, unknown>) => data.modifier === 'raiseMissThreshold',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'modifyIncomingAttack',
		}),
	};
}

declare namespace ModifyIncomingAttackRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that modifies attacks made against an actor.
 *
 * `disadvantage`, `autoMiss`, and `raiseMissThreshold` fire when the rule's
 * owner is the attack's target; the predicate is tested against the owner's
 * own domain.
 * `redirectToSelf` fires when an ally within `range` spaces is targeted: the
 * owner is offered a reaction to swap in as the target (predicate tested
 * against the owner's domain).
 *
 * Rules are consulted at attack time by the attacker's activation flow, not
 * during data preparation — adjacency and other positional tags must be fresh
 * when the attack is made.
 */
class ModifyIncomingAttackRule extends NimbleBaseRule<ModifyIncomingAttackRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.modifyIncomingAttack.description';

	declare modifier: IncomingAttackModifier;
	declare range: number;
	declare missThreshold: number;

	static override defineSchema(): ModifyIncomingAttackRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['modifier', 'string'],
				['range', 'number'],
				['missThreshold', 'number'],
			]),
		);
	}
}

export { ModifyIncomingAttackRule, type IncomingAttackModifier };
