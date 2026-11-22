import { ruleLabel } from '../../utils/actor/actorRules.js';
import { isMadeThrough } from '../../utils/damage/attackOrigin.js';
import { attackOriginField } from './_attackOriginField.js';
import type { RuleFormGroup } from './_formLayout.js';
import { NimbleBaseRule } from './base.js';

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
		{ fields: ['attackOrigin'] },
		{
			label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
			hint: 'NIMBLE.rules.reroll.form.onlyWhile.hint',
			fields: ['predicate'],
		},
	];

	declare advantage: number;
	declare ignoreDisadvantage: boolean;
	declare attackOrigin: string;

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
			]),
		);
	}

	/** The change to an attack made through the item with this identifier. Null when there is none. */
	changeFor(origin: string | null | undefined): AttackRollModeChange | null {
		if (!this.isOnActor || !this.test()) return null;
		if (!isMadeThrough(this.attackOrigin, origin)) return null;
		const advantage = Math.max(0, Math.trunc(Number(this.advantage) || 0));
		const ignoreDisadvantage = this.ignoreDisadvantage === true;
		if (advantage === 0 && !ignoreDisadvantage) return null;
		return { advantage, ignoreDisadvantage, label: ruleLabel(this) };
	}
}

export { AttackRollModeRule, type AttackRollModeChange };
