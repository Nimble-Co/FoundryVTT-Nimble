import { NimbleBaseRule } from './base.js';

type OutgoingAttackModifier = 'cannotMiss' | 'ignoreArmor';

function schema() {
	const { fields } = foundry.data;

	return {
		modifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'cannotMiss',
			choices: ['cannotMiss', 'ignoreArmor'],
			label: 'NIMBLE.rules.modifyOutgoingAttack.modifier.label',
			hint: 'NIMBLE.rules.modifyOutgoingAttack.modifier.hint',
		}),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'modifyOutgoingAttack',
		}),
	};
}

declare namespace ModifyOutgoingAttackRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that modifies every attack the owning actor makes.
 *
 * `cannotMiss` turns the primary die's miss check off entirely, so a natural 1 lands. It does not
 * touch saving throws: a save-gated effect is still avoided by succeeding the save. A target-side
 * `autoMiss` still wins, matching what `DamageRoll` does with `forceMiss`.
 *
 * `ignoreArmor` makes the attack's damage bypass the target's armor.
 *
 * Both are read at attack time rather than pushed during data preparation, so a predicate on
 * volatile state (holding a condition, adjacency) is evaluated against a fresh domain.
 */
class ModifyOutgoingAttackRule extends NimbleBaseRule<ModifyOutgoingAttackRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.modifyOutgoingAttack.description';

	declare modifier: OutgoingAttackModifier;

	static override defineSchema(): ModifyOutgoingAttackRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['modifier', 'string']]));
	}
}

export { ModifyOutgoingAttackRule, type OutgoingAttackModifier };
