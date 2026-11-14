import { SYSTEM_ID, systemHookName } from '#system';
import type { RuleSource } from '#types/ruleSource.d.ts';
import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';
import {
	type Application,
	applicationOf,
	newApplicationLastsLonger,
} from '../lastsUntil/lastsLonger.js';
import type { Moment } from '../lastsUntil/momentReached.js';
import { roundSeconds, secondsOf } from '../lastsUntil/secondsOf.js';
import { untilRemoved } from '../lastsUntil/statusLastsUntil.js';
import { type StackingEffect, stackingCopyOf, stackUp } from './effectStacks.js';

/** The delete option of an effect that a new application replaces: it does not end, so no "effect ends" moment. */
export const CONDITION_REPLACED_OPTION = 'nimbleConditionReplaced';

/** A delete that only starts the effect again. A replaced Concentration ends its activity, so it ends. */
export function replacedWithoutEnd(
	effect: { statuses?: ReadonlySet<string> | null },
	options: Record<string, unknown> | undefined,
): boolean {
	return (
		!!options?.[CONDITION_REPLACED_OPTION] && !effect.statuses?.has(STATUS_EFFECT_IDS.concentration)
	);
}

/** A create that puts back or replaces a copy: the holder gains nothing new. */
export const EFFECT_RECREATED_OPTION = 'nimbleEffectRecreated';

/** A second Taunted takes the place of the first, whatever their Lasts Until. */
const NEWEST_WINS = new Set(['taunted']);

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
export interface ExistingConditionEffect extends ReplaceableConditionEffect {
	statuses?: Set<string>;
	system?: { lastsUntil?: Moment[] };
	duration?: { value?: number | null; units?: string | null } | null;
	start?: { time?: number } | null;
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

/** An effect's combat start, in the core shape. */
export interface ConditionStart {
	combat: string;
	combatant: string;
	initiative: number | null;
	round: number;
	turn: number;
	time: number;
}

export interface ApplyConditionOptions {
	/** More create options, such as the card whose use applies the condition. */
	createOptions?: Record<string, unknown>;
	/** The feature, spell or object that caused the condition, when there is one. */
	sourceItem?: ConditionSourceDocument | null;
	/** The creature that caused the condition, used when no item is known. */
	sourceActor?: ConditionSourceDocument | null;
	/** Combat duration to stamp on the created effect. */
	duration?: ConditionDuration | null;
	/** The Lasts Until moments of the created effect. */
	lastsUntil?: Moment[] | null;
	/**
	 * Where the duration counts from, when not the current turn. A `turnStart`
	 * end comes as this combatant's turn starts.
	 */
	start?: ConditionStart | null;
	/** Opaque context forwarded verbatim to both condition hooks. */
	rule?: unknown;
	/** System flags stamped on the created effect, under the system's flag scope. */
	systemFlags?: Record<string, unknown> | null;
	/**
	 * Source data of an authored effect (name, img, description, statuses, system), put on
	 * the status effect before the options above. Each of its statuses goes through
	 * `preApplyCondition`.
	 */
	effectData?: Record<string, unknown> | null;
	/**
	 * The effects this application supersedes. Passing the key at all, an empty
	 * array included, hands the caller the duplicate decision: the target may
	 * already carry the condition, and only the named instances are removed. They
	 * go once the application is allowed, and come back if creating the
	 * replacement fails.
	 */
	replaces?: ReplaceableConditionEffect[] | null;
	/** Told the source data of the effects this application replaced, once it is on. */
	onReplaced?: (sources: Record<string, unknown>[]) => void;
}

interface StatusEffectEntry {
	id: string;
	_id?: string;
	system?: { lastsUntil?: Moment[]; rules?: RuleSource[] };
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

/** The effects that hold this condition on their own. */
function conditionEffectsOn(
	target: ConditionTargetActor,
	conditionId: string,
): ExistingConditionEffect[] {
	const effects = target.effects;
	if (!effects) return [];
	const staticId = findStatusEffectEntry(conditionId)?._id;
	if (staticId) {
		const effect = effects.get?.(staticId);
		return effect ? [effect] : [];
	}
	return [...effects].filter(
		(effect) => effect.statuses?.size === 1 && effect.statuses.has(conditionId),
	);
}

/**
 * The same condition again. The application that lasts longer stays;
 * Taunted takes the newest. Gives the effects to replace, or null to refuse.
 */
function reapplication(
	target: ConditionTargetActor,
	conditionId: string,
	options: ApplyConditionOptions,
): ExistingConditionEffect[] | null {
	if (!targetAlreadyHasCondition(target, conditionId)) return [];
	if (CONFIG.NIMBLE?.conditionStackableConditions?.has(conditionId)) return null;

	// The status can come from an effect that holds more than this condition.
	const current = conditionEffectsOn(target, conditionId);
	if (current.length < 1) return null;
	if (NEWEST_WINS.has(conditionId)) return current;

	const next: Application = {
		lastsUntil: lastsUntilOf(conditionId, options),
		duration: buildDurationPatch(options.duration),
	};
	const context = { roundSeconds: roundSeconds(), secondsOf };
	return newApplicationLastsLonger(next, current.map(applicationOf), context) ? current : null;
}

function findStatusEffectEntry(conditionId: string): StatusEffectEntry | undefined {
	const statusEffects = (CONFIG as { statusEffects?: StatusEffectEntry[] }).statusEffects;
	return statusEffects?.find((entry) => entry.id === conditionId);
}

function hasCoreDuration(options: ApplyConditionOptions): boolean {
	if (buildDurationPatch(options.duration)) return true;
	const authored = options.effectData?.duration as { value?: number | null } | null | undefined;
	return typeof authored?.value === 'number' && authored.value > 0;
}

/**
 * The moments of the new effect: the caller's, else the authored effect's. With neither, no core
 * duration and no "until removed", the status entry's own moments stay.
 */
function lastsUntilOf(conditionId: string, options: ApplyConditionOptions): Moment[] {
	if (options.lastsUntil?.length) return options.lastsUntil;
	const authored = (options.effectData?.system as { lastsUntil?: Moment[] } | undefined)
		?.lastsUntil;
	if (authored?.length) return authored;
	if (hasCoreDuration(options) || untilRemoved(options.effectData?.system)) return [];
	return findStatusEffectEntry(conditionId)?.system?.lastsUntil ?? [];
}

/**
 * The authored effect's rules, then each rule of the status entry whose id it does not have.
 * Null when the status entry has no rules.
 */
function rulesOf(conditionId: string, effectData: Record<string, unknown>): RuleSource[] | null {
	const entryRules = findStatusEffectEntry(conditionId)?.system?.rules ?? [];
	if (entryRules.length < 1) return null;
	const authored = (effectData.system as { rules?: RuleSource[] } | undefined)?.rules ?? [];
	const ids = new Set(authored.map((rule) => rule.id));
	return [...authored, ...entryRules.filter((rule) => !ids.has(rule.id))];
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

/** Core's legacy unit order and numeric-duration expiry; the status-built effect holds a null expiry. */
function buildDurationPatch(duration: ConditionDuration | null | undefined) {
	if (!duration) return null;

	for (const units of ['seconds', 'turns', 'rounds'] as const) {
		const value = duration[units];
		if (typeof value === 'number') return { value, units, expiry: 'turnStart' };
	}

	return null;
}

interface ActiveEffectImplementation {
	fromStatusEffect(
		statusId: string,
		options?: { parent: unknown },
	): Promise<AppliedConditionEffect>;
	create(
		data: AppliedConditionEffect | Record<string, unknown>,
		operation: { parent: unknown; keepId: boolean; [option: string]: unknown },
	): Promise<AppliedConditionEffect | undefined>;
	deleteDocuments(
		ids: string[],
		operation: { parent: unknown } & Record<string, unknown>,
	): Promise<unknown>;
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

	if (options.effectData) {
		const linked = [...(effect.statuses ?? [])];
		effect.updateSource(options.effectData);
		const authored = (options.effectData.statuses as string[] | undefined) ?? [];
		effect.updateSource({ statuses: [...new Set([...linked, ...authored])] });
		const rules = rulesOf(conditionId, options.effectData);
		if (rules) effect.updateSource({ 'system.rules': rules });
	}

	const patch: Record<string, unknown> = {};
	const origin = resolveConditionOrigin(options);
	if (origin) patch.origin = origin;
	const duration = buildDurationPatch(options.duration);
	if (duration) patch.duration = duration;
	if (duration && options.start) patch.start = options.start;
	patch['system.lastsUntil'] = lastsUntilOf(conditionId, options);
	if (options.systemFlags) patch[`flags.${SYSTEM_ID}`] = options.systemFlags;
	effect.updateSource(patch);

	const source = effect.toObject?.() ?? effect;
	const created = await activeEffectClass.create(
		{ ...source, type: NIMBLE_EFFECT_TYPE },
		{ parent: target, keepId: true, ...(options.createOptions ?? {}) },
	);
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

	await activeEffectImplementation().deleteDocuments(ids, {
		parent: target,
		[CONDITION_REPLACED_OPTION]: true,
	});

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
			// A refusing `preCreateActiveEffect` hook resolves undefined rather than
			// throwing, and that is a loss too.
			const restored = await activeEffectClass.create(source, {
				parent: target,
				keepId: true,
				[EFFECT_RECREATED_OPTION]: true,
			});
			if (!restored) lost += 1;
		} catch (error) {
			lost += 1;
			console.error('Nimble | Could not restore a replaced condition.', error);
		}
	}

	if (lost > 0) {
		ui.notifications?.error('NIMBLE.ui.conditionReplacementLost', { localize: true });
	}
}

function extraStatuses(options: ApplyConditionOptions): string[] {
	const statuses = options.effectData?.statuses;
	return Array.isArray(statuses) ? statuses.filter((id) => typeof id === 'string') : [];
}

/** The same stacking effect again: one more stack on the effect the holder has. */
async function addStack(
	target: ConditionTargetActor,
	conditionId: string,
	copy: StackingEffect,
	options: ApplyConditionOptions,
): Promise<AppliedConditionEffect> {
	await stackUp(
		copy,
		{
			lastsUntil: lastsUntilOf(conditionId, options),
			duration: buildDurationPatch(options.duration),
		},
		options.createOptions,
	);
	const effect = copy as unknown as AppliedConditionEffect;
	announceApplied(target, conditionId, effect, options);
	return effect;
}

function announceApplied(
	target: ConditionTargetActor,
	conditionId: string,
	effect: AppliedConditionEffect,
	options: ApplyConditionOptions,
): void {
	// @ts-expect-error - conditionApplied is a custom system hook
	Hooks.callAll(systemHookName('conditionApplied'), {
		target,
		condition: conditionId,
		effect,
		source: options.sourceItem ?? options.sourceActor ?? null,
		rule: options.rule ?? null,
	});
}

/**
 * Apply a single condition to a single actor, recording what caused it.
 *
 * Going through here gives a caller one set of guarantees: no duplicate (the
 * same condition again keeps the application that lasts longer), a blocking
 * `preApplyCondition` hook that condition immunity listens on, a recorded
 * origin, an optional Lasts Until, and a `conditionApplied` hook once the
 * effect exists. A caller replacing instances it names keeps the
 * duplicate decision and gets the swap done transactionally. The same
 * stacking effect again adds a stack to the one the target has.
 *
 * @returns the created effect, or `null` when nothing was applied.
 */
export default async function applyConditionToActor(
	target: ConditionTargetActor | null | undefined,
	conditionId: string,
	options: ApplyConditionOptions = {},
): Promise<AppliedConditionEffect | null> {
	if (!target || !conditionId) return null;
	const stacked =
		options.replaces === undefined && options.effectData
			? stackingCopyOf(target, options.effectData)
			: null;
	const replaces = stacked
		? []
		: options.replaces === undefined
			? reapplication(target, conditionId, options)
			: options.replaces;
	if (replaces === null) return null;

	const source = options.sourceItem ?? options.sourceActor ?? null;

	// Blocking hook: listeners return false to prevent application, which is how
	// condition immunity, resistance and redirects get a say.
	for (const condition of new Set([conditionId, ...extraStatuses(options)])) {
		// @ts-expect-error - preApplyCondition is a custom system hook
		const allowed = Hooks.call(systemHookName('preApplyCondition'), {
			target,
			condition,
			source,
			rule: options.rule ?? null,
		});
		if (allowed === false) return null;
	}

	if (stacked) return addStack(target, conditionId, stacked, options);

	const replacedSources = await removeReplacedEffects(target, replaces);

	const createOptions = replacedSources.length
		? { ...options.createOptions, [EFFECT_RECREATED_OPTION]: true }
		: options.createOptions;
	let effect: AppliedConditionEffect | null;
	try {
		effect = await createConditionEffect(target, conditionId, { ...options, createOptions });
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

	if (replacedSources.length) options.onReplaced?.(replacedSources);
	announceApplied(target, conditionId, effect, options);
	return effect;
}
