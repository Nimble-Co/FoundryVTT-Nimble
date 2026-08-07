import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type IncomingAttackModifier = 'disadvantage' | 'forceReroll' | 'redirectToSelf' | 'autoMiss';

function schema() {
	const { fields } = foundry.data;

	return {
		modifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'disadvantage',
			choices: ['disadvantage', 'forceReroll', 'redirectToSelf', 'autoMiss'],
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
		automatic: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.modifyIncomingAttack.automatic.label',
				hint: 'NIMBLE.rules.modifyIncomingAttack.automatic.hint',
				showWhen: (data: Record<string, unknown>) => data.modifier === 'forceReroll',
			}),
		),
		rerollTrigger: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'always',
				choices: ['always', 'hit', 'criticalHit'],
				label: 'NIMBLE.rules.modifyIncomingAttack.rerollTrigger.label',
				hint: 'NIMBLE.rules.modifyIncomingAttack.rerollTrigger.hint',
				showWhen: (data: Record<string, unknown>) => data.modifier === 'forceReroll',
			}),
		),
		rerollWithDisadvantage: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.modifyIncomingAttack.rerollWithDisadvantage.label',
				hint: 'NIMBLE.rules.modifyIncomingAttack.rerollWithDisadvantage.hint',
				showWhen: (data: Record<string, unknown>) => data.modifier === 'forceReroll',
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
 * `disadvantage`, `forceReroll`, and `autoMiss` fire when the rule's owner is
 * the attack's target; the predicate is tested against the owner's own domain.
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
	declare automatic: boolean;
	declare rerollTrigger: 'always' | 'hit' | 'criticalHit';
	declare rerollWithDisadvantage: boolean;

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
				['automatic', 'boolean'],
				['rerollTrigger', 'string'],
				['rerollWithDisadvantage', 'boolean'],
			]),
		);
	}
}

export { ModifyIncomingAttackRule, type IncomingAttackModifier };
