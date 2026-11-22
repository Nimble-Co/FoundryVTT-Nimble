import type { OfferBonus } from '#types/attackOutcome.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { ruleLabel } from '../../utils/actor/actorRules.js';
import { isMadeThrough } from '../../utils/damage/attackOrigin.js';
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
 * Extra damage and a Primary Die bonus on an attack made through one item. With
 * Feature Effects off, a row adds them.
 */
class OfferAttackBonusRule extends NimbleBaseRule<OfferAttackBonusRule.Schema> {
	declare offerSource: string;
	declare damage: string;
	declare primaryDie: number;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.offerAttackBonus.description';
	static override icon = 'fa-solid fa-handshake-angle';
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

	/** What the rule adds to an attack made through its item. Null for another attack, or with no item. */
	bonusFor(origin: string | null | undefined): OfferBonus | null {
		if (!this.isOnActor || !this.test()) return null;
		if (!this.offerSource?.trim() || !isMadeThrough(this.offerSource, origin)) return null;
		return this.offerBonus;
	}

	get offerBonus(): OfferBonus {
		return {
			label: ruleLabel(this),
			itemUuid: this.item?.uuid ?? this.parentDocument?.uuid ?? '',
			damage: Math.max(0, Math.trunc(Number(this.resolveFormula(this.damage)) || 0)),
			primaryDie: Math.trunc(Number(this.primaryDie) || 0),
		};
	}

	offersUseOn(context: RollUseContext): boolean {
		if (isRuleAutomationEnabled() || context.side !== 'roller') return false;
		if (context.roll.kind !== 'attack') return false;
		return this.bonusFor(context.roll.origin) !== null;
	}

	get rollEffect(): RollEffect {
		return 'offerBonus';
	}

	get oncePerRoll(): boolean {
		return true;
	}
}

export { OfferAttackBonusRule };
