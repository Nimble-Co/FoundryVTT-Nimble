import { findActorToken } from '#utils/movement/findActorToken.js';
import { postMovementOfferCard } from '#utils/movement/postMovementOfferCard.js';
import localize from '../localize.js';
import type { WoundCreature } from './rulesWatching.js';

/** Which way a move after a Wound or a drop may go. */
export type MoveDirection = 'any' | 'away';

export interface WoundMoveOrigin {
	uuid?: string | null;
	name?: string | null;
	actor?: (Actor | WoundCreature) | null;
}

export interface WoundMoveOptions {
	direction?: MoveDirection;
	origin?: WoundMoveOrigin | null;
}

/**
 * Offers the creature a free move of `distance` spaces. Nothing is posted when
 * it has no token, or when the distance is under 1. Away from an attacker uses
 * that attacker's token as the source. With no attacker token the offer is in
 * any direction. A chat layer that is not ready does not throw: the decision
 * has already been made.
 */
export async function offerWoundMove(
	actor: WoundCreature,
	distance: number,
	name: string,
	options: WoundMoveOptions = {},
): Promise<boolean> {
	const spaces = Math.floor(distance);
	if (!(spaces >= 1)) return false;

	const away = options.direction === 'away' ? awayFrom(actor, options.origin) : null;
	if (away) {
		return post({
			actor: away.actor,
			token: away.token,
			name,
			spaces,
			direction: 'away',
			recipients: [away.recipient],
		});
	}

	const token = tokenOf(actor);
	if (!token) return false;
	return post({
		actor: actor as Actor,
		token,
		name,
		spaces,
		direction: 'any',
		recipients: 'self',
	});
}

function tokenOf(actor: Actor | WoundCreature | null | undefined): TokenDocument | null {
	if (!actor) return null;
	try {
		return findActorToken(actor as Actor);
	} catch {
		return null;
	}
}

function originActor(origin: WoundMoveOrigin | null | undefined): Actor | null {
	if (!origin) return null;
	if (origin.actor) return origin.actor as Actor;
	if (!origin.uuid) return null;
	try {
		if (typeof fromUuidSync !== 'function') return null;
		return (fromUuidSync(origin.uuid) as Actor | null) ?? null;
	} catch {
		return null;
	}
}

function awayFrom(
	sufferer: WoundCreature,
	origin: WoundMoveOrigin | null | undefined,
): { actor: Actor; token: TokenDocument; recipient: string } | null {
	const actor = originActor(origin);
	const token = tokenOf(actor);
	const recipient = tokenOf(sufferer)?.uuid;
	if (!actor || !token || !recipient) return null;
	return { actor, token, recipient };
}

async function post(input: {
	actor: Actor;
	token: TokenDocument;
	name: string;
	spaces: number;
	direction: MoveDirection;
	recipients: 'self' | string[];
}): Promise<boolean> {
	try {
		const card = await postMovementOfferCard({
			actor: input.actor,
			token: input.token,
			name: input.name || localize('NIMBLE.activationEffects.move'),
			reason: input.name || localize('NIMBLE.activationEffects.move'),
			node: {
				kind: 'free',
				distance: String(input.spaces),
				ignoreDifficultTerrain: false,
				direction: input.direction,
			},
			recipients: input.recipients,
			whisper: true,
		});
		return !!card;
	} catch {
		return false;
	}
}
