import type { CardEventText } from '#types/cardEvent.d.ts';
import type { OfferCard } from '#types/movement.js';
import { runningRule } from '#utils/actor/actorRules.js';
import { hasRuleCharge, rulePoolState, spendRuleCharge } from '#utils/chargePool/ruleChargeGate.js';
import {
	type AttackDelivery,
	type AttackSource,
	attackSourceOf,
} from '#utils/damage/attackDelivery.js';
import { foldBonusIntoPrimaryDamage } from '#utils/damage/foldBonusIntoPrimaryDamage.js';
import {
	type IncomingReactionEntry,
	rerollTriggerMatches,
} from '#utils/incomingReactions/incomingReactionEntry.js';
import { speakerTokenUuid } from '#utils/movement/movementOffers.js';
import { offerMovement } from '#utils/movement/postMovementOfferCard.js';
import type { CardPush, ChargeConsumerRule } from '../../models/rules/chargeConsumer.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';

/** The parts of a `chargeConsumer` rule that a spend from the card reads. */
type ChargeCardOfferRule = Pick<
	ChargeConsumerRule,
	| 'id'
	| 'type'
	| 'disabled'
	| 'poolIdentifier'
	| 'cost'
	| 'cardOffer'
	| 'effectFormula'
	| 'cardPush'
	| 'providesCardOffer'
>;

/** A spend from the card after its gates pass, as the card lands it. */
export interface SpendForDamage {
	actor: Actor.Implementation;
	formula: string;
	patch: (
		bonusDamage: number,
	) => Promise<{ activation: Record<string, unknown>; rolls: string[] } | null>;
	charge: () => Promise<boolean>;
	poolLabel: string;
	usedFaces: (roll: { terms?: unknown[] }) => number[];
}

type Reject = (reasonKey: string) => void;

/** What a spend of charges from the card reads from the card. */
export interface ChargeSpendCard {
	/** The card, which hosts the line of a push. */
	card(): ChatMessage;
	isActivationCard(): boolean;
	system(): {
		targets?: string[];
		isCritical?: boolean;
		isMiss?: boolean;
		activation?: Record<string, unknown>;
	};
	rollsSource(): string[];
	flags(): Record<string, unknown> | undefined;
	attackDelivery(): AttackDelivery;
	/** The item the card was posted for. */
	sourceItem(): { type?: string } | null;
	spendsPoolAgain(entry: IncomingReactionEntry): boolean;
	queueSpendOffer(entryId: string, apply: () => Promise<void>): Promise<void>;
	spendOfferEntry(
		entryId: string,
		requestingUserId: string,
		viaSocket: boolean,
	): { entry: IncomingReactionEntry | null; reject: Reject };
	/** Roll the damage, change the card, charge the pool. Resolves whether the spend landed. */
	landSpendForDamage(
		entry: IncomingReactionEntry,
		reject: Reject,
		spend: SpendForDamage,
	): Promise<boolean>;
}

/** The kept die results of an evaluated roll. */
function rolledFaces(roll: { terms?: unknown[] }): number[] {
	type Result = { result: number; active?: boolean; discarded?: boolean };
	return ((roll.terms ?? []) as Array<{ results?: Result[] }>)
		.flatMap((term) => term.results ?? [])
		.filter((result) => result.active !== false && result.discarded !== true)
		.map((result) => result.result);
}

/** A spend of charges from a button on the card: damage for the attack, and a push. */
export class CardChargeSpend {
	#host: ChargeSpendCard;

	constructor(host: ChargeSpendCard) {
		this.#host = host;
	}

	/**
	 * Spend charges of a charge pool from the card: roll the consumer's damage
	 * formula, add it to the attack's damage, and push the targets when the rule
	 * says so. Runs on the primary GM's client, like the dice pool spend.
	 */
	async resolve(entryId: string, requestingUserId: string, viaSocket = false): Promise<void> {
		if (!game.user?.isGM) return;
		if (!this.#host.isActivationCard()) return;

		await this.#host.queueSpendOffer(entryId, () =>
			this.#apply(entryId, requestingUserId, viaSocket),
		);
	}

	async #apply(entryId: string, requestingUserId: string, viaSocket: boolean): Promise<void> {
		const host = this.#host;
		const { entry, reject } = host.spendOfferEntry(entryId, requestingUserId, viaSocket);
		if (!entry) return reject('NIMBLE.chat.incomingReactions.useFailed');

		const actor = fromUuidSync(entry.actorUuid as `Actor.${string}`) as Actor.Implementation | null;
		const rule = runningRule<ChargeCardOfferRule>(entry.itemUuid, entry.ruleId);
		const item = entry.itemUuid
			? (fromUuidSync(entry.itemUuid as `Item.${string}`) as Item.Implementation | null)
			: null;
		if (!actor || !item || rule?.type !== 'chargeConsumer') {
			return reject('NIMBLE.chat.incomingReactions.poolSpendUnavailable');
		}

		const system = host.system();
		const stillOffered =
			rule.providesCardOffer?.({
				delivery: host.attackDelivery(),
				source: this.#attackSource(),
			}) === true &&
			rerollTriggerMatches(rule.cardOffer ?? undefined, system) &&
			!host.spendsPoolAgain(entry);
		if (!stillOffered) return reject('NIMBLE.chat.incomingReactions.poolSpendNoLongerOffered');

		const identifier = String(rule.poolIdentifier ?? '');
		const cost = Math.max(1, Math.trunc(Number(rule.cost) || 1));
		const pool = rulePoolState(actor, identifier);
		if (!pool) return reject('NIMBLE.chat.incomingReactions.poolSpendUnavailable');
		if (!hasRuleCharge(actor, identifier, cost)) {
			return reject('NIMBLE.chat.incomingReactions.chargeSpendEmpty');
		}

		const landed = await host.landSpendForDamage(entry, reject, {
			actor,
			formula: String(rule.effectFormula ?? ''),
			patch: async (bonusDamage) =>
				foldBonusIntoPrimaryDamage(
					system.activation ?? { effects: [] },
					host.rollsSource(),
					bonusDamage,
					item.name ?? '',
				),
			charge: () => spendRuleCharge(actor, identifier, cost),
			poolLabel: pool.label,
			usedFaces: rolledFaces,
		});
		if (landed) {
			await this.#offerPush(actor, item, rule.cardPush ?? null, {
				key: 'NIMBLE.chat.events.cause.spentOnHit',
				data: { count: String(cost), pool: pool.label },
			});
		}
	}

	/**
	 * What the card's attack is made with. Of the cards with spend buttons,
	 * only an Unarmed Strike has no item.
	 */
	#attackSource(): AttackSource {
		const flags = this.#host.flags() as { itemUuid?: unknown; weaponUuid?: unknown } | undefined;
		if (!flags?.itemUuid) return 'weapon';
		const weaponUuid = typeof flags.weaponUuid === 'string' ? flags.weaponUuid : null;
		return attackSourceOf(this.#host.sourceItem(), weaponUuid);
	}

	/** The targets of the card get a forced move away from the attacker, as a line on the card. */
	async #offerPush(
		actor: Actor.Implementation,
		item: Item.Implementation,
		push: CardPush | null,
		reason: CardEventText,
	): Promise<void> {
		const card = this.#host.card();
		const targets = this.#host.system().targets ?? [];
		const tokenUuid = speakerTokenUuid(card as unknown as OfferCard);
		const token = tokenUuid
			? (fromUuidSync(tokenUuid as Parameters<typeof fromUuidSync>[0], {
					strict: false,
				}) as TokenDocument | null)
			: null;
		if (!push || targets.length === 0 || !token || !isMovementOffersAutomationEnabled()) return;
		await offerMovement(
			{
				actor,
				token,
				name: item.name ?? '',
				image: item.img ?? undefined,
				reason,
				node: {
					kind: 'forced',
					distance: push.distance,
					distanceBySize: push.distanceBySize,
					direction: 'away',
					ignoreDifficultTerrain: true,
				},
				recipients: [...targets],
				whisper: false,
			},
			{ card },
		);
	}
}
