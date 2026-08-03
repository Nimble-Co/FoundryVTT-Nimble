import { systemHookName } from '#system';
import { matchesAttackDelivery } from '#utils/attackDelivery.js';
import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import type { CardOfferContext } from '#utils/poolSpendCardOffers.js';
import { withWidget } from './_widgetOption.js';
import type { ItemActivatedContext } from './base.js';
import { NimbleBaseRule } from './base.js';

const DICE_CONSUMER_SCOPES = [...DicePoolRuleConfig.scopes];
const DICE_CONSUMER_MODES = [...DicePoolRuleConfig.consumptionModes];
const DICE_ATTACK_DELIVERY_FILTERS = [...DicePoolRuleConfig.attackDeliveryFilters];
const DICE_CONSUMER_EFFECT_TYPES = [...DicePoolRuleConfig.effectTypes];
const DICE_SELECTION_OUTCOMES = [...DicePoolRuleConfig.selectionOutcomes];
const DICE_CARD_OFFER_TRIGGERS = [...DicePoolRuleConfig.cardOfferTriggers];

function schema() {
	const { fields } = foundry.data;

	return {
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				widget: 'dicePoolPicker',
			}),
		),
		poolScope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			choices: DICE_CONSUMER_SCOPES,
		}),
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'manual',
			choices: DICE_CONSUMER_MODES,
		}),
		cost: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				widget: 'formula',
			}),
		),
		bonusOnAttackDelivery: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			label: 'NIMBLE.rules.diceConsumer.bonusOnAttackDelivery.label',
			hint: 'NIMBLE.rules.diceConsumer.bonusOnAttackDelivery.hint',
			choices: DICE_ATTACK_DELIVERY_FILTERS,
		}),
		effectFormula: new fields.StringField(
			withWidget({
				required: false,
				nullable: true,
				initial: null,
				widget: 'formula',
			}),
		),
		effectType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'generic',
			label: 'NIMBLE.rules.diceConsumer.effectType.label',
			hint: 'NIMBLE.rules.diceConsumer.effectType.hint',
			choices: DICE_CONSUMER_EFFECT_TYPES,
		}),
		selectionOutcome: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'consume',
			label: 'NIMBLE.rules.diceConsumer.selectionOutcome.label',
			hint: 'NIMBLE.rules.diceConsumer.selectionOutcome.hint',
			choices: DICE_SELECTION_OUTCOMES,
		}),
		cardOffer: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			label: 'NIMBLE.rules.diceConsumer.cardOffer.label',
			hint: 'NIMBLE.rules.diceConsumer.cardOffer.hint',
			choices: DICE_CARD_OFFER_TRIGGERS,
		}),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'diceConsumer',
		}),
	};
}

declare namespace DiceConsumerRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class DiceConsumerRule extends NimbleBaseRule<DiceConsumerRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.diceConsumer.description';

	// The activation-time spend request is the only way to spend pool dice —
	// there is no manual fallback — so it must fire even when rule automation
	// is toggled off.
	static override alwaysDispatchedEvents: readonly (keyof NimbleBaseRule)[] = ['onItemActivated'];

	declare poolIdentifier: string;

	declare poolScope: (typeof DicePoolRuleConfig.scopes)[number];

	declare mode: (typeof DicePoolRuleConfig.consumptionModes)[number];

	declare cost: string;

	declare bonusOnAttackDelivery: (typeof DicePoolRuleConfig.attackDeliveryFilters)[number] | null;

	declare effectFormula: string | null;

	declare effectType: (typeof DicePoolRuleConfig.effectTypes)[number];

	declare selectionOutcome: (typeof DicePoolRuleConfig.selectionOutcomes)[number];

	declare cardOffer: (typeof DicePoolRuleConfig.cardOfferTriggers)[number] | null;

	static override defineSchema(): DiceConsumerRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['poolIdentifier', 'string'],
				['poolScope', '"item" | "actor"'],
				['mode', '"manual" | "autoBonus"'],
				['cost', 'string'],
				['bonusOnAttackDelivery', '"melee" | "ranged" | "any" | null'],
				['effectFormula', 'string | null'],
				['effectType', '"generic" | "damageReduction"'],
				['selectionOutcome', '"consume" | "maximize"'],
				['cardOffer', '"hit" | "criticalHit" | null'],
			]),
		);
	}

	/** A manual spend that consumes dice for an evaluated effect. The shared
	 *  core of both the sheet flow and the card offer. */
	#isEvaluatedManualSpend(): boolean {
		if (this.mode !== 'manual') return false;
		if (this.selectionOutcome !== 'consume') return false;
		return Boolean(this.effectFormula && this.effectFormula.trim().length > 0);
	}

	/**
	 * Whether this consumer drives an interactive spend flow on activation:
	 * manual mode and the predicate passes, plus something for the panel to do
	 * — either an effect formula to evaluate, or a selection outcome that
	 * transforms the picked dice rather than spending them for an effect.
	 *
	 * A consumer offered on the attack card is spent from that card instead, so
	 * it deliberately has no sheet flow: the panel cannot see the attack's
	 * outcome, and would offer a crit-only spend on any activation.
	 */
	#providesSpendFlow(): boolean {
		if (this.mode !== 'manual') return false;
		if (this.cardOffer) return false;
		if (!this.test()) return false;
		if (this.selectionOutcome !== 'consume') return true;
		return Boolean(this.effectFormula && this.effectFormula.trim().length > 0);
	}

	/** The spend flow posts its own chat card, so the default activation card
	 *  is redundant noise. */
	protected override _autoSuppressesActivationCard(): boolean {
		return this.#providesSpendFlow();
	}

	/**
	 * Whether this consumer is also offered as a button on the owner's own
	 * attack cards, folding its effect into that card's damage instead of
	 * posting a standalone roll.
	 *
	 * Beyond an outcome trigger this needs an evaluated manual spend plus a
	 * `generic` effect: the card offer adds its total to the attack's damage,
	 * which a banked `damageReduction` is not.
	 *
	 * Restricted to character actors because the whole spend path (pools,
	 * consumers, the picker) is character-only; an NPC would stamp an offer
	 * that can only dead-end.
	 *
	 * `bonusOnAttackDelivery` narrows the offer to melee or ranged attacks. The
	 * context is optional so unrelated callers need not build one, but a caller
	 * that omits it supplies no delivery, and a rule that asks for one fails
	 * closed rather than offering itself on an attack it cannot describe.
	 */
	providesCardOffer(context?: CardOfferContext): boolean {
		if (!this.cardOffer) return false;
		if (!this.#isEvaluatedManualSpend()) return false;
		if (this.effectType !== 'generic') return false;
		if (this.item.actor?.type !== 'character') return false;
		if (!this.test()) return false;
		return matchesAttackDelivery(this.bonusOnAttackDelivery, context?.delivery ?? null);
	}

	/**
	 * Activating an item whose manual consumer has an effect formula requests
	 * the dice-spend UI for the target pool, pre-selected to this consumer.
	 * The activation card alone is a dead end (nothing on it spends dice), so
	 * the sheet's pool tracker listens for this hook and opens its spend panel.
	 * Hooks.callAll is client-local, so the panel opens only for the activating
	 * player.
	 */
	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (context.sourceItem !== (this.item as unknown)) return;
		if (!this.#providesSpendFlow()) return;

		// @ts-expect-error - dicePool.requestSpend is a custom Nimble hook
		Hooks.callAll(systemHookName('dicePool.requestSpend'), {
			actorUuid: this.item.actor.uuid,
			itemId: this.item.id,
			ruleId: this.id,
			poolIdentifier: this.poolIdentifier,
			poolScope: this.poolScope,
		});
	}
}

export { DiceConsumerRule };
