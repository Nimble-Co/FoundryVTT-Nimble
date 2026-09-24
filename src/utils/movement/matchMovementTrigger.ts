import type { MeasurableTokenDocument, MovementRecord } from '#types/movement.js';
import { reachChanges } from './reachChanges.js';
import { spacesBetween } from './spacesBetween.js';

export type TriggerCreature = 'enemy' | 'ally' | 'any';
export type TriggerGeometry =
	| 'any'
	| 'endsAdjacent'
	| 'enteredReach'
	| 'leftReach'
	| 'inPath'
	| 'movedToward';

export interface MovementTriggerOptions {
	event: 'selfMoved' | 'creatureMoved';
	/** selfMoved: which other creatures the geometry is tested against. creatureMoved: which movers count. */
	creature: TriggerCreature;
	/** Empty means no kind counts. A teleport never counts. */
	kinds: ('regular' | 'free' | 'forced')[];
	minSpaces: number;
	spacesScope: 'thisTurn' | 'thisMovement';
	geometry: TriggerGeometry;
	reach: number;
	minTargets: number;
	observerScope: 'self' | 'selfOrAllyWithin';
	/** 0 means any ally on the scene. */
	allyRadius: number;
}

type Relation = 'enemy' | 'ally' | 'neither';

function relationOf(a: TokenDocument, b: TokenDocument): Relation {
	const { FRIENDLY, HOSTILE, NEUTRAL, SECRET } = CONST.TOKEN_DISPOSITIONS;
	const dispA = a.disposition;
	const dispB = b.disposition;
	if (dispA === dispB && dispA !== NEUTRAL && dispA !== SECRET) return 'ally';
	if ((dispA === FRIENDLY && dispB === HOSTILE) || (dispA === HOSTILE && dispB === FRIENDLY))
		return 'enemy';
	return 'neither';
}

function relationMatches(a: TokenDocument, b: TokenDocument, creature: TriggerCreature): boolean {
	return creature === 'any' || relationOf(a, b) === creature;
}

function sameToken(a: TokenDocument, b: TokenDocument): boolean {
	return a === b || (a.id != null && a.id === b.id);
}

function isCandidate(token: TokenDocument): boolean {
	return !token.hidden && !!token.actor;
}

function measurable(token: TokenDocument): MeasurableTokenDocument {
	return token as unknown as MeasurableTokenDocument;
}

/** Tests the geometry between the mover's path and one watched token. */
function geometryMatches(
	record: MovementRecord,
	watched: TokenDocument,
	geometry: TriggerGeometry,
	reach: number,
): boolean {
	if (geometry === 'any') return true;
	if (geometry === 'movedToward') {
		const mover = measurable(record.token);
		const target = measurable(watched);
		return (
			spacesBetween(mover, target, { a: record.origin }) >
			spacesBetween(mover, target, { a: record.stop })
		);
	}
	const change = reachChanges(record, watched, reach);
	switch (geometry) {
		case 'endsAdjacent':
			return change.insideAtStop;
		case 'enteredReach':
			return change.entered;
		case 'leftReach':
			return change.left;
		case 'inPath':
			return change.passedThrough;
	}
}

/** The tokens the trigger found, or null when it does not fire. */
export function matchMovementTrigger(
	record: MovementRecord,
	observer: TokenDocument,
	isMover: boolean,
	options: MovementTriggerOptions,
	sceneTokens: Iterable<TokenDocument>,
): { targets: TokenDocument[] } | null {
	if (isMover !== (options.event === 'selfMoved')) return null;
	if (record.kind === 'teleport' || !options.kinds.includes(record.kind)) return null;
	const spaces =
		options.spacesScope === 'thisTurn' ? (record.spacesThisTurn ?? record.spaces) : record.spaces;
	if (spaces < options.minSpaces) return null;

	if (options.event === 'selfMoved') {
		if (options.geometry === 'any') return { targets: [] };
		const targets = [...sceneTokens].filter(
			(token) =>
				!sameToken(token, observer) &&
				!sameToken(token, record.token) &&
				isCandidate(token) &&
				relationMatches(observer, token, options.creature) &&
				geometryMatches(record, token, options.geometry, options.reach),
		);
		return targets.length >= options.minTargets ? { targets } : null;
	}

	const mover = record.token;
	if (!isCandidate(mover) || !relationMatches(observer, mover, options.creature)) return null;
	const fires = watchedTokens(record, observer, options, sceneTokens).some((watched) =>
		geometryMatches(record, watched, options.geometry, options.reach),
	);
	return fires ? { targets: [mover] } : null;
}

function watchedTokens(
	record: MovementRecord,
	observer: TokenDocument,
	options: MovementTriggerOptions,
	sceneTokens: Iterable<TokenDocument>,
): TokenDocument[] {
	if (options.observerScope === 'self') return [observer];
	const allies = [...sceneTokens].filter(
		(token) =>
			!sameToken(token, observer) &&
			!sameToken(token, record.token) &&
			isCandidate(token) &&
			relationOf(observer, token) === 'ally' &&
			(options.allyRadius <= 0 ||
				spacesBetween(measurable(observer), measurable(token)) <= options.allyRadius),
	);
	return [observer, ...allies];
}
