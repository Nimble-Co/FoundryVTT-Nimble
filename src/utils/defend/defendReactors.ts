import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';
import type { IncomingReactionEntry } from '../incomingReactions/incomingReactionEntry.js';
import {
	cardTakesDefends,
	type DefendRecord,
	damageAppliedTo,
	defendFor,
} from './defendRecords.js';

/** A hero who can react to an attack card: Defend as a target, or Interpose for an ally. */
export interface DefendReactor {
	actor: Actor.Implementation;
	/** The hero's own token among the targets, when the attack hits them. */
	targetTokenUuid: string | null;
	/** Unused Interpose offers this hero has on the card. */
	interposes: IncomingReactionEntry[];
	defend: DefendRecord | null;
}

export type DefendCardLike = {
	system: unknown;
	speaker?: { scene?: string | null; token?: string | null; actor?: string | null } | null;
};

function tokenActor(uuid: string): Actor.Implementation | null {
	return ((fromUuidSync(uuid) as TokenDocument | null)?.actor ??
		null) as Actor.Implementation | null;
}

/** The creature that made the attack on the card. */
export function speakerActorOf(card: DefendCardLike): Actor.Implementation | null {
	const speaker = card.speaker;
	if (!speaker) return null;
	const scene = speaker.scene ? game.scenes?.get(speaker.scene) : null;
	const token = speaker.token ? scene?.tokens.get(speaker.token) : null;
	return (token?.actor ??
		(speaker.actor ? game.actors?.get(speaker.actor) : null) ??
		null) as Actor.Implementation | null;
}

/** Latched On: "Your attacks can't miss or be defended/Interposed against." */
export function attackCannotBeDefended(card: DefendCardLike): boolean {
	return speakerActorOf(card)?.statuses?.has(STATUS_EFFECT_IDS.latched) === true;
}

/**
 * Every hero who can react to this card, in target order. A hero is either a
 * target (Defend) or holds an unused Interpose offer for an ally, or both.
 */
export function defendReactors(card: DefendCardLike): DefendReactor[] {
	const system = card.system as {
		targets?: string[];
		isMiss?: boolean;
		totalDamage?: number;
		incomingReactions?: IncomingReactionEntry[];
	};
	if (!cardTakesDefends(system) || system.isMiss === true) return [];
	// A minion group card stores its total; every member missed when it is 0.
	if (typeof system.totalDamage === 'number' && system.totalDamage <= 0) return [];

	const applied = damageAppliedTo(system);
	const reactors = new Map<string, DefendReactor>();
	const reactorFor = (actor: Actor.Implementation) => {
		const key = actor.uuid ?? actor.id ?? '';
		let reactor = reactors.get(key);
		if (!reactor) {
			reactor = { actor, targetTokenUuid: null, interposes: [], defend: null };
			reactors.set(key, reactor);
		}
		return reactor;
	};

	for (const uuid of system.targets ?? []) {
		const actor = tokenActor(uuid);
		if (actor?.type !== 'character') continue;
		const defend = defendFor(system, uuid);
		if (applied.has(uuid) && !defend) continue;
		const reactor = reactorFor(actor);
		reactor.targetTokenUuid ??= uuid;
		reactor.defend ??= defend;
	}

	for (const entry of system.incomingReactions ?? []) {
		if (entry.kind !== 'redirectToSelf' || entry.used) continue;
		if (!entry.targetTokenUuid || applied.has(entry.targetTokenUuid)) continue;
		if (!(system.targets ?? []).includes(entry.targetTokenUuid)) continue;
		const actor = fromUuidSync(entry.actorUuid) as Actor.Implementation | null;
		if (actor?.type !== 'character') continue;
		reactorFor(actor).interposes.push(entry);
	}

	return [...reactors.values()];
}

/** Whether this user may react for the hero: the GM, or an owner. */
export function canReactFor(actor: Actor.Implementation): boolean {
	return game.user?.isGM === true || actor.isOwner === true;
}
