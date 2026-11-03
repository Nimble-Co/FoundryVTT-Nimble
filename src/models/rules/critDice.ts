import type { CritDiceSpec } from '#types/critDice.d.ts';
import { ruleKey, ruleLabel } from '../../utils/actor/actorRules.js';
import { usedThisTurn } from '../../utils/combat/perTurnUse.js';
import {
	ATTACK_DELIVERY_FILTERS,
	type AttackDelivery,
	type AttackDeliveryFilter,
	matchesAttackDelivery,
} from '../../utils/damage/attackDelivery.js';
import {
	CRIT_BONUS_ROLE,
	type RerollTrigger,
	type RollEffect,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import { chargeOnlyCost, type RerollCost } from '../../utils/reroll/rerollCost.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels, type RollUseContext } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const DIE_ROLES = [CRIT_BONUS_ROLE] as const;

function schema() {
	const { fields } = foundry.data;
	return {
		formula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1d6',
				label: 'NIMBLE.rules.critDice.formula.label',
				hint: 'NIMBLE.rules.critDice.formula.hint',
				widget: 'diceFormula',
			}),
		),
		dieRole: new fields.StringField({
			required: true,
			nullable: false,
			initial: CRIT_BONUS_ROLE,
			choices: choiceLabels('critDice', 'dieRole', DIE_ROLES),
			label: 'NIMBLE.rules.critDice.dieRole.label',
			hint: 'NIMBLE.rules.critDice.dieRole.hint',
		}),
		oncePerTurn: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: true,
			label: 'NIMBLE.rules.critDice.oncePerTurn.label',
			hint: 'NIMBLE.rules.critDice.oncePerTurn.hint',
		}),
		attackDelivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceLabels('reroll', 'attackDelivery', ATTACK_DELIVERY_FILTERS),
			label: 'NIMBLE.rules.reroll.attackDelivery.label',
			hint: 'NIMBLE.rules.reroll.attackDelivery.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'critDice' }),
	};
}

declare namespace CritDiceRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * A crit of the owner's attack rolls more dice, as a line of their own on the
 * card. Read when the attack is rolled. With Feature Effects off it is a row in
 * Change This Roll.
 */
class CritDiceRule extends NimbleBaseRule<CritDiceRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.critDice.description';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['formula', 'dieRole', 'oncePerTurn'] },
		{ fields: ['attackDelivery'] },
		{
			label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
			hint: 'NIMBLE.rules.reroll.form.onlyWhile.hint',
			fields: ['predicate'],
		},
	];

	declare formula: string;
	declare dieRole: (typeof DIE_ROLES)[number];
	declare oncePerTurn: boolean;
	declare attackDelivery: AttackDeliveryFilter;

	static override defineSchema(): CritDiceRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['formula', 'string'],
				['dieRole', 'string'],
				['oncePerTurn', 'boolean'],
				['attackDelivery', 'string'],
			]),
		);
	}

	/** The dice this rule adds to a crit of an attack with this delivery, or null. */
	specFor(delivery: AttackDelivery | null): CritDiceSpec | null {
		if (!this.item.isEmbedded || !this.test()) return null;
		if (!matchesAttackDelivery(this.attackDelivery, delivery)) return null;
		const spec = this.critDiceSpec;
		return spec.oncePerTurn && usedThisTurn(this.actor as Actor | null, spec.key) ? null : spec;
	}

	get critDiceSpec(): CritDiceSpec {
		return {
			key: ruleKey(this),
			label: ruleLabel(this),
			role: this.dieRole,
			formula: Roll.replaceFormulaData(this.formula, this.actor?.getRollData() ?? {}, {
				missing: '0',
			}),
			...(this.oncePerTurn ? { oncePerTurn: true } : {}),
		};
	}

	/** With Feature Effects off: whether `context.side` can add the dice now. */
	offersUseOn(context: RollUseContext): boolean {
		const { roll } = context;
		if (context.side !== 'roller' || roll.kind !== 'attack') return false;
		return this.specFor(roll.delivery) !== null;
	}

	get rollEffect(): RollEffect {
		return 'critDice';
	}

	get outcome(): RerollTrigger {
		return 'criticalHit';
	}

	get oncePerAttack(): boolean {
		return true;
	}

	get rollUseCost(): RerollCost {
		return chargeOnlyCost();
	}
}

export { CritDiceRule };
