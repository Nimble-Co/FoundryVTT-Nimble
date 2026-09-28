import { SYSTEM_ID } from '#system';
import { isActorDead } from '#utils/actorHealthState.js';
import {
	ACTOR_HP_PATHS,
	ACTOR_WOUNDS_PATHS,
	hasAnyActorChangeAt,
} from '#utils/actorHpChangePaths.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import type { ConditionExpiryTrigger } from '../config/registerConditionsConfig.js';

let registered = false;

function getExpiryTriggers(): Record<string, ConditionExpiryTrigger> {
	return (
		(CONFIG.NIMBLE as { conditionExpiryTriggers?: Record<string, ConditionExpiryTrigger> })
			.conditionExpiryTriggers ?? {}
	);
}

/** The conditions on this actor that end when a linked creature dies. */
function findLinkedDeathEffects(actor: Actor.Implementation): ActiveEffect[] {
	const triggers = getExpiryTriggers();

	return Array.from(actor.effects as Iterable<ActiveEffect>).filter((effect) =>
		Array.from(effect.statuses ?? []).some(
			(statusId) => triggers[statusId as string] === 'linkedDeath',
		),
	);
}

function getLinkedActorUuid(effect: ActiveEffect): string | null {
	const flags = (effect as unknown as { flags?: Record<string, { linkedActorUuid?: unknown }> })
		.flags;
	const linkedActorUuid = flags?.[SYSTEM_ID]?.linkedActorUuid;
	return typeof linkedActorUuid === 'string' && linkedActorUuid.length > 0 ? linkedActorUuid : null;
}

/**
 * Every actor whose conditions could reference the dead one. Unlinked token actors never appear in
 * `game.actors`, so the scene's tokens are swept alongside the directory.
 */
function collectCandidateActors(): Actor.Implementation[] {
	const actors = new Map<string, Actor.Implementation>();

	for (const actor of (game.actors ?? []) as Iterable<Actor.Implementation>) {
		if (actor.uuid) actors.set(actor.uuid, actor);
	}

	for (const token of canvas?.tokens?.placeables ?? []) {
		const actor = token.actor as Actor.Implementation | null;
		if (actor?.uuid) actors.set(actor.uuid, actor);
	}

	return [...actors.values()];
}

async function expireLinkedDeathConditions(deadActor: Actor.Implementation): Promise<void> {
	const deadActorUuid = deadActor.uuid;

	for (const actor of collectCandidateActors()) {
		const expiring = findLinkedDeathEffects(actor).filter((effect) => {
			// The dead creature's own copy goes too: "until either dies" has been met from its side.
			if (actor.uuid === deadActorUuid) return true;
			return getLinkedActorUuid(effect) === deadActorUuid;
		});
		if (expiring.length === 0) continue;

		const ids = expiring.map((effect) => effect.id).filter((id): id is string => Boolean(id));
		if (ids.length === 0) continue;

		await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
	}
}

/**
 * Clears conditions that end on a bespoke trigger rather than a duration. Latched On is the case
 * this exists for: it persists "until either dies", which no rounds/turns/seconds duration can say.
 *
 * Gated to the active GM so the deletions run exactly once.
 */
export default function registerConditionExpiryHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('updateActor', (actor: Actor.Implementation, changes: Record<string, unknown>) => {
		if (!isActiveGM()) return;
		// Death can arrive via a wounds-only update: a dying PC at 0 HP gains their final wound
		// without the HP value moving at all.
		if (!hasAnyActorChangeAt(changes, [ACTOR_HP_PATHS.value, ACTOR_WOUNDS_PATHS.value])) return;
		if (!isActorDead(actor)) return;

		void expireLinkedDeathConditions(actor);
	});
}
