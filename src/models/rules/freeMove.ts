import type { CardEventText, MovementOfferHost } from '#types/cardEvent.d.ts';
import type { OfferCard } from '#types/movement.js';
import { activationEventsOf } from '#utils/chat/activationEvents.js';
import { turnMoment } from '#utils/lastsUntil/turnMoment.js';
import { alliesWithin } from '#utils/movement/alliesWithin.js';
import { findActorToken } from '#utils/movement/findActorToken.js';
import { speakerTokenUuid } from '#utils/movement/movementOffers.js';
import { firesCritTriggers } from '#utils/reroll/firesCritTriggers.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { withRuleCharge } from '../../utils/chargePool/ruleChargeGate.js';
import { findInitiativeCard } from '../../utils/movement/findInitiativeCard.js';
import { offerMovement } from '../../utils/movement/postMovementOfferCard.js';
import { withWidget } from './_widgetOption.js';
import {
	type InitiativeRolledContext,
	type ItemActivatedContext,
	type ItemUsedContext,
	NimbleBaseRule,
	type PoolGainContext,
	type TurnContext,
} from './base.js';

const TRIGGERS = [
	'onActivation',
	'onPoolGain',
	'onInitiativeRolled',
	'onTurnStart',
	'onCritReceived',
	'afterPoolDiceToMax',
] as const;

type FreeMoveTrigger = (typeof TRIGGERS)[number];

function schema() {
	const { fields } = foundry.data;

	return {
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'onActivation',
			choices: [...TRIGGERS],
			label: 'NIMBLE.rules.freeMove.trigger.label',
			hint: 'NIMBLE.rules.freeMove.trigger.hint',
		}),
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.freeMove.poolIdentifier.label',
				hint: 'NIMBLE.rules.freeMove.poolIdentifier.hint',
				widget: 'dicePoolPicker',
				showWhen: (data: Record<string, unknown>) => data.trigger === 'onPoolGain',
			}),
		),
		distance: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '@speed',
				label: 'NIMBLE.rules.freeMove.distance.label',
				hint: 'NIMBLE.rules.freeMove.distance.hint',
				widget: 'formula',
			}),
		),
		recipient: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'self',
			choices: ['self', 'allies', 'selfAndAllies'],
			label: 'NIMBLE.rules.freeMove.recipient.label',
			hint: 'NIMBLE.rules.freeMove.recipient.hint',
		}),
		within: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 0,
				initial: 12,
				label: 'NIMBLE.rules.freeMove.within.label',
				hint: 'NIMBLE.rules.freeMove.within.hint',
				showWhen: (data: Record<string, unknown>) => data.recipient !== 'self',
			}),
		),
		direction: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'any',
				choices: ['any', 'away', 'toward'],
				label: 'NIMBLE.rules.freeMove.direction.label',
				hint: 'NIMBLE.rules.freeMove.direction.hint',
				showWhen: (data: Record<string, unknown>) => data.recipient !== 'self',
			}),
		),
		ignoresDifficultTerrain: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.freeMove.ignoresDifficultTerrain.label',
			hint: 'NIMBLE.rules.freeMove.ignoresDifficultTerrain.hint',
		}),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.freeMove.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.freeMove.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		whisper: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.freeMove.whisper.label',
			hint: 'NIMBLE.rules.freeMove.whisper.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'freeMove' }),
	};
}

declare namespace FreeMoveRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface SceneTokens {
	tokens?: Iterable<TokenDocument>;
}

const REASONS = 'NIMBLE.rules.freeMove.reasons';

/**
 * Offers a Free Move when its trigger fires: a line with the move on the card of what set it off
 * (the item use, the attack, the Initiative roll, the turn start), or a Movement Offer card of its
 * own when there is none. It only offers the move; the player still decides where to go.
 */
class FreeMoveRule extends NimbleBaseRule<FreeMoveRule.Schema> {
	static override group = 'grants';
	static override description = 'NIMBLE.rules.freeMove.description';
	static override icon = 'fa-solid fa-person-running';

	// The Movement Offers toggle gates these cards, not rule automation.
	static override alwaysDispatchedEvents: readonly (keyof NimbleBaseRule)[] = [
		'onItemActivated',
		'onInitiativeRolled',
		'onActiveGmTurnStart',
		'onAttackReceived',
		'onPoolGain',
	];

	declare trigger: FreeMoveTrigger;
	declare poolIdentifier: string;
	declare distance: string;
	declare recipient: 'self' | 'allies' | 'selfAndAllies';
	declare within: number;
	declare direction: 'any' | 'away' | 'toward';
	declare ignoresDifficultTerrain: boolean;
	declare chargePoolIdentifier: string;
	declare whisper: boolean;

	static override defineSchema(): FreeMoveRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['trigger', 'string'],
				['poolIdentifier', 'string'],
				['distance', 'string'],
				['recipient', 'string'],
				['within', 'number'],
				['direction', 'string'],
				['ignoresDifficultTerrain', 'boolean'],
				['chargePoolIdentifier', 'string'],
			]),
		);
	}

	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (!this.isOnActor) return;
		if (!this.test()) return;
		if (this.trigger !== 'onActivation') return;
		if (!this.item || context.sourceItem?.uuid !== this.item.uuid) return;
		const use = activationEventsOf(this.actor);
		const host: MovementOfferHost | null = context.card
			? { card: context.card }
			: use
				? { activation: use }
				: null;
		await this.#offer(
			{ key: `${REASONS}.onActivation`, data: { item: this.parentDocument.name ?? '' } },
			speakerToken(context.card),
			host,
		);
	}

	override async onInitiativeRolled(context: InitiativeRolledContext): Promise<void> {
		if (!this.isOnActor) return;
		if (!this.test()) return;
		if (this.trigger !== 'onInitiativeRolled') return;
		if (context.actor !== this.actor) return;
		const card = await findInitiativeCard(context.combatant, context.rollId);
		await this.#offer(
			{ key: `${REASONS}.onInitiativeRolled` },
			context.combatant?.token ?? null,
			card ? { card } : null,
		);
	}

	// The stored trigger stays `onTurnStart`; the active-GM hook posts the card once.
	override async onActiveGmTurnStart(context: TurnContext): Promise<void> {
		if (!this.isOnActor) return;
		if (!this.test()) return;
		if (this.trigger !== 'onTurnStart') return;
		if (context.actor !== this.actor) return;
		const turn = turnMoment('turnStart', context.combatant as never, context.place);
		await this.#offer(
			{ key: `${REASONS}.onTurnStart` },
			context.combatant?.token ?? null,
			turn ? { moment: turn.moment } : null,
		);
	}

	override async onAttackReceived(context: ItemUsedContext): Promise<void> {
		if (!this.isOnActor) return;
		if (!this.test()) return;
		if (this.trigger !== 'onCritReceived') return;
		if (!firesCritTriggers(context) || context.targetActor !== this.actor) return;
		await this.#offer(
			{ key: `${REASONS}.onCritReceived` },
			targetTokenOf(context.card, this.actor),
			context.card ? { card: context.card } : null,
		);
	}

	override async onPoolGain(context: PoolGainContext): Promise<void> {
		if (!this.isOnActor) return;
		if (!this.test()) return;
		if (this.trigger !== 'onPoolGain') return;
		const identifier = this.poolIdentifier.trim();
		if (!identifier || identifier !== context.poolIdentifier) return;
		const pool = context.poolLabel || identifier;
		await this.#offer({ key: `${REASONS}.onPoolGain`, data: { pool } }, null, this.#useHost());
	}

	/** A rule of this item raised pool dice, or would with some held. */
	async offerAfterPoolDice(): Promise<void> {
		if (!this.isOnActor || !this.test() || this.trigger !== 'afterPoolDiceToMax') return;
		await this.#offer(
			{ key: `${REASONS}.afterPoolDiceToMax`, data: { item: this.parentDocument.name ?? '' } },
			null,
			this.#useHost(),
		);
	}

	/** The item use of the actor that is going on now, as the host of a line. */
	#useHost(): MovementOfferHost | null {
		const use = activationEventsOf(this.actor);
		return use ? { activation: use } : null;
	}

	async #offer(
		reason: CardEventText,
		contextToken: TokenDocument | null,
		host: MovementOfferHost | null,
	): Promise<void> {
		if (!isMovementOffersAutomationEnabled()) return;
		const { actor } = this;
		await withRuleCharge(actor, this.chargePoolIdentifier, async () => {
			const token = contextToken ?? findActorToken(actor);
			if (!token) return null;
			const recipients = this.#recipients(token);
			if (recipients !== 'self' && recipients.length === 0) return null;

			const offered = await offerMovement(
				{
					actor,
					token,
					name: this.label || this.parentDocument.name,
					image: this.parentDocument.img ?? undefined,
					reason,
					node: {
						kind: 'free',
						distance: this.distance,
						direction: this.direction,
						ignoreDifficultTerrain: this.ignoresDifficultTerrain,
					},
					recipients,
					whisper: this.whisper,
				},
				host,
			);
			return offered || null;
		});
	}

	#recipients(source: TokenDocument): 'self' | string[] {
		if (this.recipient === 'self') return 'self';
		const sceneTokens = (source.parent as SceneTokens | null)?.tokens ?? [];
		const allies = alliesWithin(source, sceneTokens, this.within)
			.map((token) => token.uuid)
			.filter((uuid): uuid is string => !!uuid);
		if (this.recipient !== 'selfAndAllies') return allies;
		return source.uuid ? [source.uuid, ...allies] : allies;
	}
}

function tokenFromUuid(uuid: string): TokenDocument | null {
	return (fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false }) ??
		null) as TokenDocument | null;
}

function speakerToken(card: ChatMessage | null): TokenDocument | null {
	const uuid = card ? speakerTokenUuid(card as unknown as OfferCard) : null;
	return uuid ? tokenFromUuid(uuid) : null;
}

/** The token of `actor` among the attack card's targets. */
function targetTokenOf(card: ChatMessage | null, actor: Actor): TokenDocument | null {
	const targets = (card as unknown as OfferCard | null)?.system?.targets ?? [];
	for (const uuid of targets) {
		const token = tokenFromUuid(uuid);
		if (token?.actor === actor) return token;
	}
	return null;
}

export { FreeMoveRule };
