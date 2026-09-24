import type { MeasurableTokenDocument } from '#types/movement.js';
import { isMovementTrackingAutomationEnabled } from '../../settings/automationSettings.js';
import { getSpacesMovedThisTurn } from './getSpacesMovedThisTurn.js';
import { spacesBetween } from './spacesBetween.js';

type SourceActor = Parameters<typeof getSpacesMovedThisTurn>[0];

export interface TargetSpacesAway {
	tokenUuid: string;
	name: string;
	spaces: number;
}

/** What an activation card records about Movement when it is posted. */
export interface MovementContext {
	spacesMovedThisTurn: number | null;
	targetsSpacesAway: TargetSpacesAway[];
}

export interface ContextToken extends MeasurableTokenDocument {
	name: string;
	actor?: SourceActor | null;
	parent?: (MeasurableTokenDocument['parent'] & { id?: string | null }) | null;
}

export interface ContextCard {
	speaker?: { scene?: string | null; token?: string | null; actor?: string | null };
	system?: { targets?: string[]; movementContext?: MovementContext | null };
}

export interface MovementContextLookups {
	resolveToken?: (uuid: string) => ContextToken | null;
	measure?: (a: ContextToken, b: ContextToken) => number;
	/** The actor that used the card, when the caller already holds it. */
	source?: SourceActor | null;
	spacesMovedThisTurn?: (actor: SourceActor) => number | null;
	trackingEnabled?: boolean;
}

function resolveTokenByUuid(uuid: string): ContextToken | null {
	const token = fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false });
	return (token as unknown as ContextToken | null) ?? null;
}

function speakerTokenUuid(card: ContextCard): string | null {
	const speaker = card.speaker;
	return speaker?.scene && speaker.token ? `Scene.${speaker.scene}.Token.${speaker.token}` : null;
}

function sameScene(a: ContextToken, b: ContextToken): boolean {
	if (!a.parent || !b.parent) return false;
	if (a.parent.id && b.parent.id) return a.parent.id === b.parent.id;
	return a.parent === b.parent;
}

/**
 * The card's Movement context once it is posted or its targets change. Spaces
 * Moved This Turn is read once, when the card is first stamped. Each target is
 * measured from the speaker token once, when it is added, and dropped when it
 * is removed. A target not on the speaker token's scene is skipped.
 */
export function reconcileMovementContext(
	card: ContextCard,
	lookups: MovementContextLookups = {},
): MovementContext {
	const resolveToken = lookups.resolveToken ?? resolveTokenByUuid;
	const measure = lookups.measure ?? spacesBetween;
	const existing = card.system?.movementContext ?? null;
	const speakerUuid = speakerTokenUuid(card);
	let speakerToken: ContextToken | null | undefined;
	const findSpeakerToken = () => {
		if (speakerToken === undefined) speakerToken = speakerUuid ? resolveToken(speakerUuid) : null;
		return speakerToken;
	};

	let spacesMovedThisTurn: number | null;
	if (existing) {
		spacesMovedThisTurn = existing.spacesMovedThisTurn ?? null;
	} else {
		const enabled = lookups.trackingEnabled ?? isMovementTrackingAutomationEnabled();
		const actor = lookups.source !== undefined ? lookups.source : findSpeakerToken()?.actor;
		const read = lookups.spacesMovedThisTurn ?? getSpacesMovedThisTurn;
		spacesMovedThisTurn = enabled && actor ? read(actor) : null;
	}

	const previous = existing?.targetsSpacesAway ?? [];
	const targetsSpacesAway: TargetSpacesAway[] = [];
	for (const tokenUuid of card.system?.targets ?? []) {
		const kept = previous.find((entry) => entry.tokenUuid === tokenUuid);
		if (kept) {
			targetsSpacesAway.push(kept);
			continue;
		}
		const source = findSpeakerToken();
		const target = resolveToken(tokenUuid);
		if (!source || !target || !sameScene(source, target)) continue;
		const spaces = measure(source, target);
		if (!Number.isFinite(spaces)) continue;
		targetsSpacesAway.push({ tokenUuid, name: target.name, spaces });
	}

	return { spacesMovedThisTurn, targetsSpacesAway };
}
