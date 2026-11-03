import type { OfferBonus } from '#types/attackOutcome.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { ruleLabel } from '../../utils/actor/actorRules.js';
import type { RollEffect } from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RuleFormGroup } from './_formLayout.js';
import type { RollUseContext } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		offerSource: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.offerAttackBonus.offerSource.label',
			hint: 'NIMBLE.rules.offerAttackBonus.offerSource.hint',
		}),
		damage: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.offerAttackBonus.damage.label',
				hint: 'NIMBLE.rules.offerAttackBonus.damage.hint',
				widget: 'diceFormula',
			}),
		),
		primaryDie: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			integer: true,
			label: 'NIMBLE.rules.offerAttackBonus.primaryDie.label',
			hint: 'NIMBLE.rules.offerAttackBonus.primaryDie.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'offerAttackBonus' }),
	};
}

declare namespace OfferAttackBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Extra damage and a Primary Die bonus on an attack made from the offer row of
 * one item. With Feature Effects off, a row adds them.
 */
class OfferAttackBonusRule extends NimbleBaseRule<OfferAttackBonusRule.Schema> {
	declare offerSource: string;
	declare damage: string;
	declare primaryDie: number;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.offerAttackBonus.description';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['offerSource', 'damage', 'primaryDie'] },
	];

	static override defineSchema(): OfferAttackBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['offerSource', 'string'],
				['damage', 'string'],
				['primaryDie', 'number'],
			]),
		);
	}

	/** What the rule adds to an attack from the offer of this item. Null for another attack. */
	bonusFor(offerSource: string | null | undefined): OfferBonus | null {
		if (!this.item.isEmbedded || !this.test()) return null;
		if (!offerSource || offerSource !== this.offerSource) return null;
		return this.offerBonus;
	}

	get offerBonus(): OfferBonus {
		return {
			label: ruleLabel(this),
			damage: Math.max(0, Math.trunc(Number(this.resolveFormula(this.damage)) || 0)),
			primaryDie: Math.trunc(Number(this.primaryDie) || 0),
		};
	}

	offersUseOn(context: RollUseContext): boolean {
		if (isRuleAutomationEnabled() || context.side !== 'roller') return false;
		if (context.roll.kind !== 'attack') return false;
		return this.bonusFor(context.roll.offerSource) !== null;
	}

	get rollEffect(): RollEffect {
		return 'offerBonus';
	}

	get oncePerRoll(): boolean {
		return true;
	}
}

export { OfferAttackBonusRule };
