import { SYSTEM_ID } from '#system';
import { isActorDead } from '#utils/actor/actorHealthState.js';
import {
	ACTOR_HP_PATHS,
	ACTOR_WOUNDS_PATHS,
	hasAnyActorChangeAt,
} from '#utils/actor/actorHpChangePaths.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import type { ConditionExpiryTrigger } from '../config/registerConditionsConfig.js';

let registered = false;

function isActorConditionEffect(effect: ActiveEffect): boolean {
	if (effect.parent?.documentName !== 'Actor') return false;
	return [...effect.statuses].some((statusId) => Object.hasOwn(CONFIG.NIMBLE.conditions, statusId));
}

function setsExpired(changed: object): boolean {
	return foundry.utils.getProperty(changed, 'duration.expired') === true;
}

async function deleteExpiredCondition(effect: ActiveEffect): Promise<void> {
	if (!effect.id || !effect.parent?.effects.has(effect.id)) return;
	try {
		await effect.delete();
	} catch (error) {
		console.warn('Nimble | Failed to remove an expired condition:', error);
	}
}

function getExpiryTriggers(): Record<string, ConditionExpiryTrigger> {
	return (
		(CONFIG.NIMBLE as { conditionExpiryTriggers?: Record<string, ConditionExpiryTrigger> })
			.conditionExpiryTriggers ?? {}
	);
}

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
			if (actor.uuid === deadActorUuid) return true;
			return getLinkedActorUuid(effect) === deadActorUuid;
		});
		if (expiring.length === 0) continue;

		const ids = expiring.map((effect) => effect.id).filter((id): id is string => Boolean(id));
		if (ids.length > 0) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
	}
}

/** Deletes duration-expired conditions and conditions whose linked creature died. */
export function registerConditionExpiryHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('updateActiveEffect', async (effect, changed, _options, userId) => {
		if (userId !== game.user?.id) return;
		if (!setsExpired(changed) || !isActorConditionEffect(effect)) return;
		await deleteExpiredCondition(effect);
	});

	Hooks.on('updateActor', (actor: Actor.Implementation, changes: Record<string, unknown>) => {
		if (!isActiveGM()) return;
		if (!hasAnyActorChangeAt(changes, [ACTOR_HP_PATHS.value, ACTOR_WOUNDS_PATHS.value])) return;
		if (!isActorDead(actor)) return;
		void expireLinkedDeathConditions(actor);
	});
}
