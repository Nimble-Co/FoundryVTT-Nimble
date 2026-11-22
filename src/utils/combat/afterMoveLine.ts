import type { MeasurableTokenDocument, OfferCard } from '#types/movement.js';
import type { AfterMoveCheck } from '../../models/rules/grantActivation.js';
import { readToggledEffects } from '../actor/toggledEffects.js';
import localize from '../localize.js';
import { relationOf } from '../movement/matchMovementTrigger.js';
import { speakerTokenUuid } from '../movement/movementOffers.js';
import { spacesBetween } from '../movement/spacesBetween.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';

/** The mark list that holds a Hunter's quarry. */
const QUARRY_FLAG_KEY = 'quarry';

const WARNINGS = 'NIMBLE.chat.grantedActionOffers.afterMoveWarnings';

export interface AfterMoveLineCheck {
	afterMoveCheck: AfterMoveCheck;
	afterMoveMinEnemies: number;
	afterMoveStatus: string;
}

/**
 * Whether a line that waits for the user's move shows: once each move of the card to its speaker
 * has ended, made or not. A move whose turn ended first keeps it hidden. With nothing to track the
 * move, the line shows at once.
 */
export function afterMoveLineShown(card: OfferCard, tracking: boolean): boolean {
	if (!tracking) return true;
	const speaker = speakerTokenUuid(card);
	const moves = new Set(
		flattenEffectsTree(card.system?.activation?.effects ?? [])
			.filter((node) => node.type === 'move')
			.map((node) => node.id),
	);
	return !(card.system?.movementOffers ?? []).some(
		(offer) =>
			moves.has(offer.nodeId) &&
			offer.tokenUuid === speaker &&
			offer.spaces > 0 &&
			(offer.state === 'open' || offer.state === 'lapsed'),
	);
}

interface CheckedToken {
	id?: string | null;
	hidden?: boolean;
	actor?: {
		uuid?: string;
		statuses?: Set<string>;
		getFlag?: (scope: string, key: string) => unknown;
	} | null;
	parent?: { tokens?: Iterable<CheckedToken> } | null;
}

function adjacentTokens(mover: CheckedToken): CheckedToken[] {
	return [...(mover.parent?.tokens ?? [])].filter(
		(token) =>
			token !== mover &&
			(token.id == null || token.id !== mover.id) &&
			!token.hidden &&
			!!token.actor &&
			spacesBetween(
				mover as unknown as MeasurableTokenDocument,
				token as unknown as MeasurableTokenDocument,
				undefined,
				1,
			) <= 1,
	);
}

function quarryUuids(mover: CheckedToken): Set<string> {
	const actor = mover.actor;
	if (!actor?.getFlag) return new Set();
	const entries = readToggledEffects(actor as { getFlag: typeof actor.getFlag & {} })[
		QUARRY_FLAG_KEY
	];
	return new Set((Array.isArray(entries) ? entries : []).map((entry) => entry.actorUuid));
}

function conditionName(statusId: string): string {
	const key = (CONFIG.NIMBLE?.conditions as Record<string, string> | undefined)?.[statusId];
	return key ? localize(key) : statusId;
}

/**
 * The warning a line shows when its check fails where the mover stopped, or null when the check
 * passes, the line has none, or there is no token to check from.
 */
export function afterMoveWarning(
	line: AfterMoveLineCheck,
	mover: CheckedToken | null,
	name: string,
): string | null {
	if (!mover || line.afterMoveCheck === 'none') return null;
	const adjacent = adjacentTokens(mover);
	switch (line.afterMoveCheck) {
		case 'adjacentToQuarry': {
			const quarry = quarryUuids(mover);
			const found = adjacent.some((token) => quarry.has(token.actor?.uuid ?? ''));
			return found ? null : localize(`${WARNINGS}.adjacentToQuarry`, { name });
		}
		case 'adjacentEnemies': {
			const count = adjacent.filter(
				(token) =>
					relationOf(mover as unknown as TokenDocument, token as unknown as TokenDocument) ===
					'enemy',
			).length;
			const min = line.afterMoveMinEnemies;
			return count >= min
				? null
				: localize(`${WARNINGS}.adjacentEnemies`, { name, count: String(count), min: String(min) });
		}
		case 'adjacentToCondition': {
			const status = line.afterMoveStatus;
			if (!status) return null;
			const found = adjacent.some((token) => token.actor?.statuses?.has(status));
			return found
				? null
				: localize(`${WARNINGS}.adjacentToCondition`, { name, condition: conditionName(status) });
		}
		default:
			return null;
	}
}
