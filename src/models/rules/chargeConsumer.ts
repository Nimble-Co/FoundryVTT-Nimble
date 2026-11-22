import { ChargePoolRuleConfig } from '#utils/chargePool/chargePoolRuleConfig.js';
import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import type { CardOfferContext } from '#utils/incomingReactions/poolSpendCardOffers.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const CHARGE_CONSUMER_SCOPES = [...ChargePoolRuleConfig.scopes];
const CHARGE_CONSUMER_COST_MODES = [...ChargePoolRuleConfig.costModes];
const CARD_OFFER_TRIGGERS = [...DicePoolRuleConfig.cardOfferTriggers];
const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
const WORDS = 'NIMBLE.rules.chargeConsumer';

const offeredOnCard = (data: Record<string, unknown>) => !!data.cardOffer;

/** The push for each size. Blank uses the push distance. */
function pushBySizeField() {
	const { fields } = foundry.data;
	const size = (key: (typeof SIZES)[number]) =>
		new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: `NIMBLE.sizeCategories.${key}`,
		});
	return new fields.SchemaField(
		{
			tiny: size('tiny'),
			small: size('small'),
			medium: size('medium'),
			large: size('large'),
			huge: size('huge'),
			gargantuan: size('gargantuan'),
		},
		withWidget({
			label: `${WORDS}.pushDistanceBySize.label`,
			hint: `${WORDS}.pushDistanceBySize.hint`,
			showWhen: offeredOnCard,
		}),
	);
}

function schema() {
	const { fields } = foundry.data;

	return {
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				widget: 'chargePoolPicker',
			}),
		),
		poolScope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'item',
			choices: CHARGE_CONSUMER_SCOPES,
		}),
		costMode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'fixed',
			label: 'NIMBLE.rules.chargeConsumer.costMode.label',
			hint: 'NIMBLE.rules.chargeConsumer.costMode.hint',
			choices: () =>
				Object.fromEntries(
					CHARGE_CONSUMER_COST_MODES.map((mode) => [
						mode,
						`NIMBLE.rules.chargeConsumer.costMode.choices.${mode}`,
					]),
				),
		}),
		cost: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.chargeConsumer.cost.label',
				hint: 'NIMBLE.rules.chargeConsumer.cost.hint',
				widget: 'formula',
			}),
		),
		maxCost: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.chargeConsumer.maxCost.label',
				hint: 'NIMBLE.rules.chargeConsumer.maxCost.hint',
				widget: 'formula',
				showWhen: (data: Record<string, unknown>) => data.costMode === 'variable',
			}),
		),
		allowFree: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.chargeConsumer.allowFree.label',
				hint: 'NIMBLE.rules.chargeConsumer.allowFree.hint',
				showWhen: (data: Record<string, unknown>) => data.costMode !== 'variable',
			}),
		),
		oncePerTurn: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.chargeConsumer.oncePerTurn.label',
			hint: 'NIMBLE.rules.chargeConsumer.oncePerTurn.hint',
		}),
		cardOffer: new fields.StringField({
			required: false,
			nullable: true,
			initial: null,
			label: `${WORDS}.cardOffer.label`,
			hint: `${WORDS}.cardOffer.hint`,
			choices: CARD_OFFER_TRIGGERS,
		}),
		effectFormula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: `${WORDS}.effectFormula.label`,
				hint: `${WORDS}.effectFormula.hint`,
				widget: 'diceFormula',
				showWhen: offeredOnCard,
			}),
		),
		pushDistance: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: `${WORDS}.pushDistance.label`,
				hint: `${WORDS}.pushDistance.hint`,
				widget: 'formula',
				showWhen: offeredOnCard,
			}),
		),
		pushDistanceBySize: pushBySizeField(),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'chargeConsumer',
		}),
	};
}

declare namespace ChargeConsumerRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ChargeConsumerRule extends NimbleBaseRule<ChargeConsumerRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'resource';
	static override description = 'NIMBLE.rules.chargeConsumer.description';
	static override icon = 'fa-solid fa-arrow-down-from-line';

	declare poolIdentifier: string;

	declare poolScope: (typeof ChargePoolRuleConfig.scopes)[number];

	/**
	 * `fixed` spends `cost` every activation. `variable` makes `cost` the
	 * smallest legal spend and asks the player for the rest, which is what a
	 * "spend any amount" pool needs.
	 */
	declare costMode: (typeof ChargePoolRuleConfig.costModes)[number];

	declare cost: string;

	/** Ceiling for a variable spend. Blank means the pool's current charges. */
	declare maxCost: string;

	/** The roll window has a tick to use the item with no charge. */
	declare allowFree: boolean;

	/** A use with this charge is 1/turn, shared with the item's 1/turn options. */
	declare oncePerTurn: boolean;

	/** The spend is a button on the owner's attack cards after this outcome, not a cost of a use. */
	declare cardOffer: (typeof DicePoolRuleConfig.cardOfferTriggers)[number] | null;

	/** The damage a spend from the card adds to the attack. */
	declare effectFormula: string;

	/** The spaces a spend from the card pushes the targets. Blank for no push. */
	declare pushDistance: string;

	// `pushDistanceBySize` is inferred from the schema: a formula for each size.

	static override defineSchema(): ChargeConsumerRule.Schema {
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
				['costMode', '"fixed" | "variable"'],
				['cost', 'string'],
				['maxCost', 'string'],
				['allowFree', 'boolean'],
				['oncePerTurn', 'boolean'],
				['cardOffer', '"hit" | "criticalHit" | null'],
				['effectFormula', 'string'],
				['pushDistance', 'string'],
				['pushDistanceBySize', 'Record<size, string>'],
			]),
		);
	}

	/** Whether the owner's attack card offers this spend. Heroes only: they hold the pools. */
	providesCardOffer(_context?: CardOfferContext): boolean {
		if (!this.cardOffer) return false;
		if (!String(this.effectFormula ?? '').trim()) return false;
		if (this.parentItem.actor?.type !== 'character') return false;
		return this.test();
	}

	/** The push a spend from the card gives the targets, or null for none. */
	get cardPush(): { distance: string; distanceBySize: Record<string, string> } | null {
		const distanceBySize = Object.fromEntries(
			Object.entries(this.pushDistanceBySize ?? {}).filter(([, formula]) =>
				String(formula ?? '').trim(),
			),
		) as Record<string, string>;
		const distance = String(this.pushDistance ?? '').trim();
		if (!distance && Object.keys(distanceBySize).length === 0) return null;
		return { distance: distance || '0', distanceBySize };
	}

	override afterPrepareData(): void {
		if (!this.isOnActor || !this.cardOffer) return;
		this.checkReferences(this.effectFormula);
		this.checkReferences(this.pushDistance);
	}
}

export { ChargeConsumerRule };
