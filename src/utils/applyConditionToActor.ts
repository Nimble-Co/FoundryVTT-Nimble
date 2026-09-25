import { SYSTEM_ID, systemHookName } from '#system';

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
	/** The stored source, which is what gets written when the effect is created. */
	toObject?(): Record<string, unknown>;
}

/**
 * An effect a new application supersedes. Removal goes through the parent actor
 * in one call, so an id and the stored source are all it needs.
 */
export interface ReplaceableConditionEffect {
	id?: string;
	toObject?(): Record<string, unknown>;
}

/** What this helper reads off a condition already on the target. */
interface ExistingConditionEffect {
	statuses?: Set<string>;
}

/**
 * The parts of an Actor this helper reads or creates against.
 */
export interface ConditionTargetActor {
	statuses?: Set<string>;
	effects?: {
		get?(id: string): ExistingConditionEffect | undefined;
		[Symbol.iterator](): Iterator<ExistingConditionEffect>;
	};
}

/** A document that can stand as the recorded source of a condition. */
interface ConditionSourceDocument {
	/** Nullable because Foundry's own `uuid` is; a null one records no origin. */
	uuid?: string | null;
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
	/** System flags stamped on the created effect, under the system's flag scope. */
	systemFlags?: Record<string, unknown> | null;
	/**
	 * The effects this application supersedes. Passing the key at all, an empty
	 * array included, hands the caller the duplicate decision: the target may
	 * already carry the condition, and only the named instances are removed. They
	 * go once the application is allowed, and come back if creating the
	 * replacement fails.
	 */
	replaces?: ReplaceableConditionEffect[] | null;
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

interface ActiveEffectImplementation {
	fromStatusEffect(
		statusId: string,
		options?: { parent: unknown },
	): Promise<AppliedConditionEffect>;
	create(
		data: AppliedConditionEffect | Record<string, unknown>,
		operation: { parent: unknown; keepId: boolean },
	): Promise<AppliedConditionEffect | undefined>;
	deleteDocuments(ids: string[], operation: { parent: unknown }): Promise<unknown>;
}

function activeEffectImplementation(): ActiveEffectImplementation {
	return (ActiveEffect as unknown as { implementation: ActiveEffectImplementation }).implementation;
}

/**
 * `Actor#toggleStatusEffect` takes only `{ active, overlay }`, so it can never
 * record an origin. This mirrors what it does internally instead: build the
 * effect from the registered status entry, patch it at the source, then create
 * it with the same `keepId` semantics, which is what preserves the static `_id`
 * that linked-status conditions dedupe on.
 *
 * Creation takes `toObject()` rather than the effect itself, matching what V14's
 * `toggleStatusEffect` does. The difference matters: `updateDuration` replaces the
 * live `duration` field with a *derived* object carrying `label`, `remaining` and
 * an `Infinity` default value, so handing over the document would clean that
 * derived data into the stored source. `toObject()` returns `_source`, which is
 * where `updateSource` wrote the patch above.
 */
async function createConditionEffect(
	target: ConditionTargetActor,
	conditionId: string,
	options: ApplyConditionOptions,
): Promise<AppliedConditionEffect | null> {
	const activeEffectClass = activeEffectImplementation();

	const effect = await activeEffectClass.fromStatusEffect(conditionId, { parent: target });

	const patch: Record<string, unknown> = {};
	const origin = resolveConditionOrigin(options);
	if (origin) patch.origin = origin;
	const duration = buildDurationPatch(options.duration);
	if (duration) patch.duration = duration;
	if (options.systemFlags) patch[`flags.${SYSTEM_ID}`] = options.systemFlags;
	if (Object.keys(patch).length > 0) effect.updateSource(patch);

	const created = await activeEffectClass.create(effect.toObject?.() ?? effect, {
		parent: target,
		keepId: true,
	});
	return created ?? null;
}

/**
 * Remove the superseded effects, keeping their stored sources so a failed
 * replacement can put them back exactly as they were.
 *
 * One `deleteDocuments` call rather than a delete each, so a refusal partway
 * cannot leave the target holding some of them and none of the replacement.
 */
async function removeReplacedEffects(
	target: ConditionTargetActor,
	replaces: ReplaceableConditionEffect[] | null | undefined,
): Promise<Record<string, unknown>[]> {
	if (!replaces?.length) return [];

	const ids: string[] = [];
	const sources: Record<string, unknown>[] = [];

	for (const effect of replaces) {
		if (!effect.id) continue;
		ids.push(effect.id);
		const source = effect.toObject?.();
		if (source) sources.push(source);
	}

	if (ids.length === 0) return [];

	await activeEffectImplementation().deleteDocuments(ids, { parent: target });

	return sources;
}

/**
 * Put back what `removeReplacedEffects` took, so a caster whose replacement was
 * refused keeps the condition they had rather than ending with none.
 *
 * Whatever refused the replacement usually refuses the restore too, and losing a
 * condition silently is worse than the original failure, so the loss is told to
 * the user rather than left in the console.
 */
async function restoreReplacedEffects(
	target: ConditionTargetActor,
	sources: Record<string, unknown>[],
): Promise<void> {
	if (sources.length === 0) return;

	const activeEffectClass = activeEffectImplementation();
	let lost = 0;

	for (const source of sources) {
		try {
			await activeEffectClass.create(source, { parent: target, keepId: true });
		} catch (error) {
			lost += 1;
			console.error('Nimble | Could not restore a replaced condition.', error);
		}
	}

	if (lost > 0) {
		ui.notifications?.error('NIMBLE.ui.conditionReplacementLost', { localize: true });
	}
}

/**
 * Apply a single condition to a single actor, recording what caused it.
 *
 * Going through here gives a caller one set of guarantees: no duplicate
 * application, a blocking `preApplyCondition` hook that condition immunity
 * listens on, a recorded origin, an optional duration, and a `conditionApplied`
 * hook once the effect exists. A caller replacing instances it names keeps the
 * duplicate decision and gets the swap done transactionally.
 *
 * @returns the created effect, or `null` when nothing was applied.
 */
export default async function applyConditionToActor(
	target: ConditionTargetActor | null | undefined,
	conditionId: string,
	options: ApplyConditionOptions = {},
): Promise<AppliedConditionEffect | null> {
	if (!target || !conditionId) return null;
	if (options.replaces === undefined && targetAlreadyHasCondition(target, conditionId)) return null;

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

	const replacedSources = await removeReplacedEffects(target, options.replaces);

	let effect: AppliedConditionEffect | null;
	try {
		effect = await createConditionEffect(target, conditionId, options);
	} catch (error) {
		await restoreReplacedEffects(target, replacedSources);
		throw error;
	}

	// `Document.create` resolves undefined when a preCreate hook or _preCreate
	// returns false, which is a refusal rather than a failure.
	if (!effect) {
		await restoreReplacedEffects(target, replacedSources);
		return null;
	}

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
