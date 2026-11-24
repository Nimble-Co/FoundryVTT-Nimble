import { findActorToken } from '#utils/movement/findActorToken.js';
import { postMovementOfferCard } from '#utils/movement/postMovementOfferCard.js';
import localize from '../localize.js';
import type { WoundCreature } from './rulesWatching.js';

/**
 * Offers the creature a free move of `distance` spaces. Nothing is posted when
 * it has no token, or when the distance is under 1. A chat layer that is not
 * ready does not throw: the Wound decision has already been made.
 */
export async function offerWoundMove(
	actor: WoundCreature,
	distance: number,
	name: string,
): Promise<boolean> {
	const spaces = Math.floor(distance);
	if (!(spaces >= 1)) return false;

	let token: TokenDocument | null = null;
	try {
		token = findActorToken(actor as Actor);
	} catch {
		return false;
	}
	if (!token) return false;

	try {
		const card = await postMovementOfferCard({
			actor: actor as Actor,
			token,
			name: name || localize('NIMBLE.activationEffects.move'),
			reason: name || localize('NIMBLE.activationEffects.move'),
			node: {
				kind: 'free',
				distance: String(spaces),
				ignoreDifficultTerrain: false,
				direction: 'any',
			},
			recipients: 'self',
			whisper: true,
		});
		return !!card;
	} catch {
		return false;
	}
}
