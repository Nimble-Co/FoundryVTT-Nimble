import type { MoveNodeProps } from '#types/components/MoveNode.d.ts';
import type { MovementOffer, OfferCard } from '#types/movement.js';
import localize from '#utils/localize.ts';
import { movementOfferOutcome, speakerTokenUuid } from '#utils/movement/movementOffers.js';

/** The parts of the chat card that the move node reads. */
export interface MoveNodeCard {
	speaker?: OfferCard['speaker'] | null;
	system?: unknown;
}

interface MoveNodeCardSystem {
	actorName?: string;
	movementOffers?: MovementOffer[];
}

function spacesText(count: number): string {
	return localize(`NIMBLE.chat.movementOffers.${count === 1 ? 'space' : 'spaces'}`, {
		count: String(count),
	});
}

function distanceText(offer: MovementOffer): string {
	return localize('NIMBLE.chat.movementOffers.upTo', { distance: spacesText(offer.spaces) });
}

function resultText(offer: MovementOffer): string | null {
	const outcome = movementOfferOutcome(offer);
	switch (outcome.state) {
		case 'taken':
			return localize(
				`NIMBLE.chat.movementOffers.results.${outcome.shortfall > 0 ? 'shortened' : 'taken'}`,
				{
					moved: String(outcome.moved ?? 0),
					offered: spacesText(outcome.offered),
					short: String(outcome.shortfall),
				},
			);
		case 'unused':
			return localize('NIMBLE.chat.movementOffers.results.unused');
		case 'lapsed':
			return localize('NIMBLE.chat.movementOffers.results.lapsed');
		default:
			return null;
	}
}

function separated(parts: (string | null)[]): string {
	return parts
		.filter((part) => part)
		.map((part) => ` - ${part}`)
		.join('');
}

export function createMoveNodeState(getProps: () => MoveNodeProps, card: MoveNodeCard | undefined) {
	// Not reactive: Foundry renders the message again on each update, which mounts a new card.
	const system = (card?.system ?? {}) as MoveNodeCardSystem;
	const speakerUuid = speakerTokenUuid({ speaker: card?.speaker ?? undefined });

	const offers = $derived(
		(system.movementOffers ?? []).filter(
			(offer) => offer.nodeId === getProps().node.id && offer.spaces > 0,
		),
	);
	const selfOffer = $derived(
		offers.length === 1 && offers[0].tokenUuid === speakerUuid ? offers[0] : null,
	);
	const headingSuffix = $derived.by(() => {
		const { direction } = getProps().node;
		const directionText =
			direction === 'any'
				? null
				: localize(`NIMBLE.chat.movementOffers.directions.${direction}`, {
						source: system.actorName ?? '',
					});
		const selfText = selfOffer ? (resultText(selfOffer) ?? distanceText(selfOffer)) : null;
		return separated([directionText, selfText]);
	});
	const kindLabel = $derived(localize(`NIMBLE.chat.movementOffers.kinds.${getProps().node.kind}`));
	const showsTerrainTag = $derived(
		getProps().node.kind === 'free' && getProps().node.ignoreDifficultTerrain,
	);

	return {
		get offers() {
			return offers;
		},
		get selfOffer() {
			return selfOffer;
		},
		get headingSuffix() {
			return headingSuffix;
		},
		get kindLabel() {
			return kindLabel;
		},
		get showsTerrainTag() {
			return showsTerrainTag;
		},
		distanceText,
		resultSuffix: (offer: MovementOffer) => separated([resultText(offer)]),
		damageOwed: (offer: MovementOffer) => movementOfferOutcome(offer).damageOwed,
	};
}
