import { ruleLabel } from '../../utils/actor/actorRules.js';
import { isMadeThrough, type OriginAttacker } from '../../utils/damage/attackOrigin.js';
import { attackOriginField, originAttackerField } from './_attackOriginField.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

/** The attacks a rule changes: every attack, or only opportunity attacks. */
const ATTACK_KINDS = ['any', 'opportunity'] as const;

type AttackKind = (typeof ATTACK_KINDS)[number];

/** What a rule needs to know about an attack besides its origin. */
interface AttackKindContext {
	opportunityAttack?: boolean;
}

function schema() {
	const { fields } = foundry.data;

	return {
		advantage: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 0,
			label: 'NIMBLE.rules.attackRollMode.advantage.label',
			hint: 'NIMBLE.rules.attackRollMode.advantage.hint',
		}),
		ignoreDisadvantage: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.attackRollMode.ignoreDisadvantage.label',
			hint: 'NIMBLE.rules.attackRollMode.ignoreDisadvantage.hint',
		}),
		attackOrigin: attackOriginField(),
		originAttacker: originAttackerField(),
		attackKind: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			label: 'NIMBLE.rules.attackRollMode.attackKind.label',
			hint: 'NIMBLE.rules.attackRollMode.attackKind.hint',
			choices: choiceLabels('attackRollMode', 'attackKind', ATTACK_KINDS),
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'attackRollMode' }),
	};
}

declare namespace AttackRollModeRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** What one rule does to the roll mode of an attack. */
interface AttackRollModeChange {
	advantage: number;
	ignoreDisadvantage: boolean;
	label: string;
}

/**
 * Changes the roll mode of the owner's attacks: steps of advantage, and all
 * disadvantage taken out, Rushed Attacks too. The roll window opens with the
 * change, and a roll with no window gets it.
 */
class AttackRollModeRule extends NimbleBaseRule<AttackRollModeRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.attackRollMode.description';
	static override icon = 'fa-solid fa-arrows-up-down';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['advantage', 'ignoreDisadvantage'] },
		{ fields: ['attackOrigin', 'originAttacker', 'attackKind'] },
		{
			label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
			hint: 'NIMBLE.rules.reroll.form.onlyWhile.hint',
			fields: ['predicate'],
		},
	];

	declare advantage: number;
	declare ignoreDisadvantage: boolean;
	declare attackOrigin: string;
	declare originAttacker: OriginAttacker;
	declare attackKind: AttackKind;

	static override defineSchema(): AttackRollModeRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['advantage', 'number'],
				['ignoreDisadvantage', 'boolean'],
				['attackOrigin', 'string'],
				['originAttacker', '"self" | "anyone"'],
				['attackKind', '"any" | "opportunity"'],
			]),
		);
	}

	get originScope(): string {
		return this.attackOrigin ?? '';
	}

	/** The change to an attack made through the item with this identifier. Null when there is none. */
	changeFor(
		origin: string | null | undefined,
		attack: AttackKindContext = {},
	): AttackRollModeChange | null {
		if (!this.isOnActor || !this.test()) return null;
		if (!isMadeThrough(this.attackOrigin, origin)) return null;
		if (this.attackKind === 'opportunity' && !attack.opportunityAttack) return null;
		const advantage = Math.max(0, Math.trunc(Number(this.advantage) || 0));
		const ignoreDisadvantage = this.ignoreDisadvantage === true;
		if (advantage === 0 && !ignoreDisadvantage) return null;
		return { advantage, ignoreDisadvantage, label: ruleLabel(this) };
	}
}

export { AttackRollModeRule, type AttackKindContext, type AttackRollModeChange };
