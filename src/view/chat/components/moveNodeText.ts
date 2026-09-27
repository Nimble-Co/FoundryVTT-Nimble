import type { MovementChip, MovementStatus } from '#types/components/MovementStatusChip.d.ts';
import type { EffectNode, MoveNode } from '#types/effectTree.js';
import type { MovementOffer, OfferCard } from '#types/movement.js';
import localize from '#utils/localize.ts';
import {
	isSaveOutcome,
	movementOfferOutcome,
	speakerTokenUuid,
} from '#utils/movement/movementOffers.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

/** The parts of a chat card that the move node text reads. */
export interface MoveTextCard {
	speaker?: OfferCard['speaker'] | null;
	system?: unknown;
}

interface MoveTextCardSystem {
	actorName?: string;
	movementOffers?: MovementOffer[];
	activation?: { effects?: EffectNode[] };
}

export interface MoveNodeText {
	/** "Forced Movement" or "Free Move". */
	kindLabel: string;
	/** The offers of this node the card lists: each one with a distance. */
	offers: MovementOffer[];
	summary: string;
	chip(offer: MovementOffer): MovementChip;
	/** The book's reminder for a push that fell short, or null. */
	obstacleDamage(offer: MovementOffer): string | null;
}

export interface MoveTextOptions {
	/** Movement Offers and Movement Tracking are on, so a drag settles an open offer. */
	tracking: boolean;
}

const KEY = 'NIMBLE.chat.movementOffers';

const STATUS_ICONS: Record<MovementStatus, string> = {
	open: 'fa-person-running',
	taken: 'fa-check',
	partial: 'fa-check',
	short: 'fa-triangle-exclamation',
	unused: 'fa-xmark',
	lapsed: 'fa-clock',
	untracked: 'fa-person-running',
	conditional: 'fa-dice-d20',
};

function movementStatus(offer: MovementOffer, tracking: boolean): MovementStatus {
	if (offer.conditional) return 'conditional';
	const outcome = movementOfferOutcome(offer);
	switch (outcome.state) {
		case 'taken':
			if (outcome.shortfall > 0) return 'short';
			return (outcome.moved ?? 0) < outcome.offered ? 'partial' : 'taken';
		case 'unused':
		case 'lapsed':
		case 'untracked':
			return outcome.state;
		default:
			return tracking ? 'open' : 'untracked';
	}
}

function spacesText(count: number): string {
	return localize(`${KEY}.${count === 1 ? 'space' : 'spaces'}`, { count: String(count) });
}

function upTo(count: number): string {
	return localize(`${KEY}.upTo`, { distance: spacesText(count) });
}

/** The save outcome nearest above the node, or null when no save decides it. */
function saveOutcomeAbove(node: MoveNode, effects: EffectNode[]): string | null {
	const byId = new Map(flattenEffectsTree(effects).map((entry) => [entry.id, entry]));
	const seen = new Set<EffectNode>();
	for (
		let cursor: EffectNode | undefined = byId.get(node.id) ?? node;
		cursor?.parentNode && !seen.has(cursor);
		cursor = byId.get(cursor.parentNode)
	) {
		seen.add(cursor);
		const context = cursor.parentContext ?? '';
		if (isSaveOutcome(context)) return context;
	}
	return null;
}

function saveKey(outcome: string | null): 'failedSave' | 'passedSave' | 'otherSave' {
	if (outcome === 'failedSave') return 'failedSave';
	if (outcome === 'passedSave') return 'passedSave';
	return 'otherSave';
}

export function moveNodeText(
	card: MoveTextCard | undefined,
	node: MoveNode,
	options: MoveTextOptions,
): MoveNodeText {
	const system = (card?.system ?? {}) as MoveTextCardSystem;
	const source = system.actorName ?? '';
	const offers = (system.movementOffers ?? []).filter(
		(offer) => offer.nodeId === node.id && offer.spaces > 0,
	);
	const speakerUuid = speakerTokenUuid({ speaker: card?.speaker ?? undefined });
	// A move for the feature's user alone has no one to move away from or toward.
	const hidesDirection =
		node.recipient === 'self' || (offers.length === 1 && offers[0].tokenUuid === speakerUuid);
	const isForced = node.kind === 'forced';

	const way = hidesDirection ? 'any' : node.direction;
	let direction = '';
	if (!hidesDirection && node.direction !== 'any') {
		direction = localize(`${KEY}.directions.${node.direction}`, { source });
	} else if (!hidesDirection && isForced) {
		direction = localize(`${KEY}.directions.any`);
	}
	const terrain =
		!isForced && node.ignoreDifficultTerrain ? localize(`${KEY}.ignoringDifficultTerrain`) : '';
	const verb = localize(`${KEY}.verbs.${way}.past`);
	const passive = localize(`${KEY}.verbs.${way}.passive`);

	const distances = new Set(offers.map((offer) => offer.spaces));
	const shared = distances.size === 1 ? [...distances][0] : null;
	const shape = offers.length === 0 ? 'None' : shared === null ? 'Each' : '';
	const summary = localize(`${KEY}.summary.${isForced ? 'forced' : 'free'}${shape}`, {
		verb,
		distance: shared === null ? '' : upTo(shared),
		direction,
		terrain,
	});

	const obstacleDamage = (offer: MovementOffer): string | null => {
		const outcome = movementOfferOutcome(offer);
		if (!outcome.damageOwed) return null;
		return localize(`${KEY}.obstacleDamage`, {
			name: offer.name,
			dice: String(outcome.shortfall),
		});
	};

	const chip = (offer: MovementOffer): MovementChip => {
		const status = movementStatus(offer, options.tracking);
		// "Not moved" would deny the move the creature made instead.
		const unusedAny = status === 'unused' && isForced && way === 'any';
		const data = {
			verb,
			passive,
			direction,
			terrain,
			distance: upTo(offer.spaces),
			offered: spacesText(offer.spaces),
			moved: String(movementOfferOutcome(offer).moved ?? 0),
		};
		const kindKey = `${KEY}.status.${isForced ? 'forced' : 'free'}`;

		let tooltip: string;
		if (status === 'conditional') {
			tooltip = localize(
				`${kindKey}.${saveKey(saveOutcomeAbove(node, system.activation?.effects ?? []))}`,
				data,
			);
		} else if (status === 'untracked') {
			// Nothing records the drag, so the chip states the move instead of waiting for it.
			tooltip = localize(`${KEY}.summary.${isForced ? 'forced' : 'free'}`, data);
		} else {
			tooltip = localize(`${kindKey}.${unusedAny ? 'unusedAny' : status}`, data);
		}
		const damage = obstacleDamage(offer);
		if (damage) tooltip = `${tooltip} ${damage}`;

		let label: string;
		switch (status) {
			case 'taken':
			case 'partial':
			case 'short':
				label = `${data.moved}/${offer.spaces}`;
				break;
			case 'unused':
			case 'lapsed':
				label =
					isForced && !unusedAny
						? localize(`${KEY}.chip.notMoved`, { passive })
						: localize(`${KEY}.chip.notUsed`);
				break;
			default:
				label = String(offer.spaces);
		}

		return { key: offer.id, status, icon: STATUS_ICONS[status], label, tooltip };
	};

	return {
		kindLabel: localize(`${KEY}.kinds.${node.kind}`),
		offers,
		summary,
		chip,
		obstacleDamage,
	};
}

/** Every chip the card holds for one creature, across all of its move nodes. */
export function movementChipsFor(
	card: MoveTextCard | undefined,
	tokenUuid: string,
	options: MoveTextOptions,
): MovementChip[] {
	const effects = ((card?.system ?? {}) as MoveTextCardSystem).activation?.effects ?? [];
	return flattenEffectsTree(effects)
		.filter((node): node is MoveNode => node.type === 'move')
		.flatMap((node) => {
			const text = moveNodeText(card, node, options);
			return text.offers.filter((offer) => offer.tokenUuid === tokenUuid).map(text.chip);
		});
}
