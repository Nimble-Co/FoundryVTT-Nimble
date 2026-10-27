import type { MeasurableTokenDocument } from '#types/movement.js';
import type { IncomingReactionEntry } from '../incomingReactions/incomingReactionEntry.js';
import { areAllies } from '../movement/alliesWithin.js';
import { spacesBetween } from '../movement/spacesBetween.js';
import { REROLL_RULE_TYPE, type RerollAlly, type RerollingActor } from './rerollEntries.js';

interface ScannedActor extends RerollingActor {
	type?: string;
	hasPlayerOwner?: boolean;
}

interface ScannedToken {
	id?: string | null;
	uuid: string;
	hidden?: boolean;
	disposition?: number;
	actor?: ScannedActor | null;
	parent?: { tokens?: Iterable<ScannedToken> } | null;
}

interface RollerActor {
	token?: ScannedToken | null;
	getActiveTokens?: (linked?: boolean, document?: boolean) => unknown[];
}

type MeasureSpaces = (a: ScannedToken, b: ScannedToken) => number;

const measureOnGrid: MeasureSpaces = (a, b) =>
	spacesBetween(a as unknown as MeasurableTokenDocument, b as unknown as MeasurableTokenDocument);

/** The token the one who rolled stands on: its own for an unlinked actor, else its first on the scene. */
function rollerTokenOf(actor: unknown): ScannedToken | null {
	const roller = actor as RollerActor | null | undefined;
	if (!roller) return null;
	if (roller.token) return roller.token;
	const [token] = roller.getActiveTokens?.(false, true) ?? [];
	return (token as ScannedToken | undefined) ?? null;
}

function hasAllyReroll(actor: ScannedActor): boolean {
	return (actor.rules ?? []).some(
		(rule) => rule?.type === REROLL_RULE_TYPE && (rule as { usedBy?: string }).usedBy === 'ally',
	);
}

function isPlayerCharacter(actor: ScannedActor | null | undefined): boolean {
	return actor?.type === 'character' && actor.hasPlayerOwner === true;
}

/**
 * Two player characters are always allies, whatever their token disposition.
 * Other tokens are allies when their disposition says so.
 */
function countsAsAlly(roller: ScannedToken, other: ScannedToken): boolean {
	if (isPlayerCharacter(roller.actor) && isPlayerCharacter(other.actor)) return true;
	return areAllies(roller as unknown as TokenDocument, other as unknown as TokenDocument);
}

/**
 * The creatures on the roller's scene that have an ally-side reroll, with
 * whether they count as an ally and how many spaces away they are. Measured
 * once, when the roll is made. No token for the one who rolled means none.
 */
function scanRerollAllies(
	rollerToken: ScannedToken | null | undefined,
	measure: MeasureSpaces = measureOnGrid,
): RerollAlly[] {
	const sceneTokens = rollerToken?.parent?.tokens;
	if (!rollerToken || !sceneTokens) return [];
	const rollerActorUuid = rollerToken.actor?.uuid;
	const allies: RerollAlly[] = [];
	for (const token of sceneTokens) {
		const actor = token.actor;
		if (!actor || token.hidden || token.uuid === rollerToken.uuid) continue;
		if (actor.uuid === rollerActorUuid || !hasAllyReroll(actor)) continue;
		allies.push({
			tokenUuid: token.uuid,
			actor,
			isAlly: countsAsAlly(rollerToken, token),
			spaces: measure(rollerToken, token),
		});
	}
	return allies;
}

/**
 * The allies of a card that was already posted: those with an ally entry that
 * counts. The scan is not run again, so a reroll later keeps the allies the
 * card was posted with.
 */
function alliesOnCard(entries: readonly IncomingReactionEntry[]): RerollAlly[] {
	const seen = new Set<string>();
	const allies: RerollAlly[] = [];
	for (const entry of entries) {
		if (entry.kind !== 'reroll' || entry.side !== 'ally' || entry.leftOut) continue;
		const key = `${entry.actorUuid}|${entry.tokenUuid ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		allies.push({
			tokenUuid: entry.tokenUuid ?? '',
			actor: fromUuidSync(entry.actorUuid as `Actor.${string}`) as RerollingActor | null,
			isAlly: true,
			spaces: 0,
		});
	}
	return allies;
}

export { alliesOnCard, countsAsAlly, rollerTokenOf, type ScannedToken, scanRerollAllies };
