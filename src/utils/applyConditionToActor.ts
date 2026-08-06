import { systemHookName } from '#system';

export interface ConditionDuration {
	rounds?: number | null;
	turns?: number | null;
	seconds?: number | null;
}

/**
 * The parts of an ActiveEffect this helper hands back to callers. Kept
 * structural so a caller can pass a stand-in document without a cast.
 */
export interface AppliedConditionEffect {
	id?: string;
	statuses?: Set<string>;
	updateSource(data: Record<string, unknown>): unknown;
}

/**
 * The parts of an Actor this helper reads or creates against.
 */
export interface ConditionTargetActor {
	statuses?: Set<string>;
	effects?: {
		get?(id: string): AppliedConditionEffect | undefined;
		[Symbol.iterator](): Iterator<AppliedConditionEffect>;
	};
}

/** A document that can stand as the recorded source of a condition. */
interface ConditionSourceDocument {
	uuid?: string;
}

export interface ApplyConditionOptions {
	/** The feature, spell or object that caused the condition, when there is one. */
	sourceItem?: ConditionSourceDocument | null;
	/** The creature that caused the condition, used when no item is known. */
	sourceActor?: ConditionSourceDocument | null;
	/** Combat duration to stamp on the created effect. */
	duration?: ConditionDuration | null;
	/** Opaque context forwarded verbatim to both condition hooks. */
	rule?: unknown;
}

interface StatusEffectEntry {
	id: string;
	_id?: string;
}

/**
 * Whether the target already carries this condition, so applying it again would
 * either stack a duplicate or collide on a reserved id.
 *
 * `Actor#statuses` only lists statuses granted by *active* effects, so a
 * disabled effect holding the status is invisible there. Conditions with linked
 * statuses are registered with a static `_id` (see `ConditionManager`), and
 * creating a second effect with that id would fail, so the effect collection is
 * checked the same way `Actor#toggleStatusEffect` checks it.
 */
function targetAlreadyHasCondition(target: ConditionTargetActor, conditionId: string): boolean {
	if (target.statuses?.has(conditionId)) return true;

	const effects = target.effects;
	if (!effects) return false;

	const staticId = findStatusEffectEntry(conditionId)?._id;
	if (staticId) return Boolean(effects.get?.(staticId));

	for (const effect of effects) {
		if (effect.statuses?.size === 1 && effect.statuses.has(conditionId)) return true;
	}

	return false;
}

function findStatusEffectEntry(conditionId: string): StatusEffectEntry | undefined {
	const statusEffects = (CONFIG as { statusEffects?: StatusEffectEntry[] }).statusEffects;
	return statusEffects?.find((entry) => entry.id === conditionId);
}

/**
 * The uuid recorded as the effect's origin, which is what the conditions
 * readout resolves into a source name. The item is preferred so the readout
 * names the feature; the actor is the fallback so it at least names the
 * creature. Neither being known leaves the effect sourceless, which is how a
 * hand-toggled condition should read.
 */
function resolveConditionOrigin(options: ApplyConditionOptions): string | null {
	const itemUuid = options.sourceItem?.uuid;
	if (typeof itemUuid === 'string' && itemUuid.length > 0) return itemUuid;

	const actorUuid = options.sourceActor?.uuid;
	if (typeof actorUuid === 'string' && actorUuid.length > 0) return actorUuid;

	return null;
}

function buildDurationPatch(duration: ConditionDuration | null | undefined) {
	if (!duration) return null;

	const patch: Record<string, number> = {};
	if (typeof duration.rounds === 'number') patch.rounds = duration.rounds;
	if (typeof duration.turns === 'number') patch.turns = duration.turns;
	if (typeof duration.seconds === 'number') patch.seconds = duration.seconds;

	return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * `Actor#toggleStatusEffect` takes only `{ active, overlay }`, so it can never
 * record an origin. This mirrors what it does internally instead: build the
 * effect from the registered status entry, patch it at the source, then create
 * it with the same `keepId` semantics, which is what preserves the static `_id`
 * that linked-status conditions dedupe on.
 */
async function createConditionEffect(
	target: ConditionTargetActor,
	conditionId: string,
	options: ApplyConditionOptions,
): Promise<AppliedConditionEffect | null> {
	const activeEffectClass = (
		ActiveEffect as unknown as {
			implementation: {
				fromStatusEffect(statusId: string): Promise<AppliedConditionEffect>;
				create(
					data: AppliedConditionEffect,
					operation: { parent: unknown; keepId: boolean },
				): Promise<AppliedConditionEffect | undefined>;
			};
		}
	).implementation;

	const effect = await activeEffectClass.fromStatusEffect(conditionId);

	const patch: Record<string, unknown> = {};
	const origin = resolveConditionOrigin(options);
	if (origin) patch.origin = origin;
	const duration = buildDurationPatch(options.duration);
	if (duration) patch.duration = duration;
	if (Object.keys(patch).length > 0) effect.updateSource(patch);

	const created = await activeEffectClass.create(effect, { parent: target, keepId: true });
	return created ?? null;
}

/**
 * Apply a single condition to a single actor, recording what caused it.
 *
 * Going through here gives a caller one set of guarantees: no duplicate
 * application, a blocking `preApplyCondition` hook that condition immunity
 * listens on, a recorded origin, an optional duration, and a `conditionApplied`
 * hook once the effect exists.
 *
 * @returns the created effect, or `null` when nothing was applied.
 */
export default async function applyConditionToActor(
	target: ConditionTargetActor | null | undefined,
	conditionId: string,
	options: ApplyConditionOptions = {},
): Promise<AppliedConditionEffect | null> {
	if (!target || !conditionId) return null;
	if (targetAlreadyHasCondition(target, conditionId)) return null;

	const source = options.sourceItem ?? options.sourceActor ?? null;

	// Blocking hook: listeners return false to prevent application, which is how
	// condition immunity, resistance and redirects get a say.
	// @ts-expect-error - preApplyCondition is a custom system hook
	const allowed = Hooks.call(systemHookName('preApplyCondition'), {
		target,
		condition: conditionId,
		source,
		rule: options.rule ?? null,
	});
	if (allowed === false) return null;

	const effect = await createConditionEffect(target, conditionId, options);

	// @ts-expect-error - conditionApplied is a custom system hook
	Hooks.callAll(systemHookName('conditionApplied'), {
		target,
		condition: conditionId,
		effect,
		source,
		rule: options.rule ?? null,
	});

	return effect;
}
