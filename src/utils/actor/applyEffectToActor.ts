import { SYSTEM_ID } from '#system';
import type { EffectPayload, StackReached } from '#types/effectPayload.d.ts';
import type { MomentRaise, RuleRaise } from '#types/spellScaling.js';
import { askActiveGm } from '#utils/askActiveGm.js';
import { effectCardOption } from '#utils/damage/damageCard.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { applicationOf, newApplicationLastsLonger } from '#utils/lastsUntil/lastsLonger.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { raiseMoments } from '#utils/lastsUntil/raiseMoments.js';
import { roundSeconds, secondsOf } from '#utils/lastsUntil/secondsOf.js';
import { checkFormulaReferences } from '#utils/rolls/formulaReferences.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import applyConditionToActor, {
	CONDITION_REPLACED_OPTION,
	EFFECT_RECREATED_OPTION,
	type ExistingConditionEffect,
} from './applyConditionToActor.js';
import { type StackingEffect, stackingCopyOf, stacksOf, stackUp } from './effectStacks.js';
import { giveTempHp, tempHpGrant } from './effectTempHp.js';
import { postStackGain } from './stackGainEvent.js';
import { itemEffectOf } from './itemEffectOf.js';

const QUERY_NAME = `${SYSTEM_ID}.applyEffect`;

/** Fields of the item's effect that the copy on the holder does not keep. */
const NOT_COPIED = ['_id', '_stats', 'origin', 'start', 'transfer', 'disabled', 'sort', 'folder'];

export interface AppliedEffect {
	effectUuid: string;
	actorName: string;
	/** the holder had the same effect from the same origin, and it lasts as long or longer: it stays */
	stays?: boolean;
	/** the holder kept more temp HP than the effect gives */
	tempHpRefused?: { temp: number; amount: number };
	/** The stacks of a stacking effect after this application. */
	stacks?: number;
	/** This application reached the "At N stacks" count of the effect. */
	stackReached?: StackReached;
	/** The source data of the older copies this application replaced. */
	replaced?: Record<string, unknown>[];
}

interface SourceUser {
	type: string;
	uuid?: string | null;
	getRollData(): Record<string, unknown>;
}

interface EffectHolder {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
	system?: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
	effects?: Iterable<
		ExistingConditionEffect & { uuid?: string; origin?: string | null; name?: string | null }
	>;
}

interface CreatedEffect {
	id?: string | null;
	uuid?: string;
	update?(data: Record<string, unknown>): Promise<unknown>;
}

/** The Escape DC as a number, from the roll data of the one who used the item. */
function escapeDc(formula: unknown, user: SourceUser | null): string {
	const written = typeof formula === 'string' ? formula.trim() : '';
	if (!written) return '';
	const dc = resolveSaveNodeDC(written, user);
	return dc === null ? written : String(dc);
}

/** Text fields of a rule that are names, not formulas. */
const NOT_FORMULAS = new Set([
	'id',
	'type',
	'label',
	'identifier',
	'predicate',
	'description',
	'title',
	'message',
	'cardHint',
]);

/** Text with a link such as `@UUID[...]` or `@Check[...]` is no formula. */
const ENRICHER = /@[A-Z][A-Za-z]*\[/;

/**
 * The `@` references of each rule formula, from the roll data of the one who used the item: the
 * numbers of the caster at the time it is applied, not the holder's.
 */
function resolveRuleFormulas(rules: unknown, user: SourceUser | null): void {
	if (!user || !Array.isArray(rules)) return;
	let rollData: Record<string, unknown> | null = null;
	for (const rule of rules as Record<string, unknown>[]) {
		if (!rule || typeof rule !== 'object') continue;
		for (const [key, value] of Object.entries(rule)) {
			if (NOT_FORMULAS.has(key) || typeof value !== 'string' || !value.includes('@')) continue;
			if (ENRICHER.test(value)) continue;
			// The count of stacks is the holder's, read when the rule runs. `@speed` is the mover's.
			rollData ??= { ...user.getRollData(), stacks: '@stacks', speed: '@speed' };
			checkFormulaReferences(value, user, {}, { rollData });
			// A reference the source has no value for is 0 here, not the holder's value at the roll.
			rule[key] = Roll.replaceFormulaData(value, rollData, { missing: '0' });
		}
	}
}

/** What an upcast adds to the copy: to fields of its rules, and to numbers of its Lasts Until. */
export interface EffectRaises {
	rules?: readonly RuleRaise[];
	moments?: readonly MomentRaise[];
}

/**
 * Adds each upcast raise to its rule's field: the amount to a number, and the formula once for
 * each step to a formula.
 */
function raiseRules(rules: unknown, raises: readonly RuleRaise[]): void {
	if (!Array.isArray(rules)) return;
	for (const { ruleId, field, amount, formula, steps } of raises) {
		const rule = (rules as Record<string, unknown>[]).find((entry) => entry?.id === ruleId);
		if (!rule) continue;
		const current = rule[field];
		if (formula) {
			if (!steps || (typeof current !== 'string' && current != null)) continue;
			const terms = Array.from({ length: steps }, () => formula).join(' + ');
			rule[field] = typeof current === 'string' && current.trim() ? `${current} + ${terms}` : terms;
		} else if (typeof current === 'number' && Number.isFinite(current)) {
			rule[field] = current + amount;
		}
	}
}

/**
 * A copy of an item's effect for an actor, with the upcast raises added. The Escape DC is worked
 * out now, and the rule formulas too unless the effect's rules read the creature that has it.
 */
export function payloadFromEffect(
	effect: { toObject(): Record<string, unknown> },
	source: { itemUuid: string | null; user: SourceUser | null; raises?: EffectRaises },
): EffectPayload {
	const data = foundry.utils.deepClone(effect.toObject());
	for (const key of NOT_COPIED) delete data[key];
	const system = data.system as
		| { escape?: { dc?: unknown }; rules?: unknown; lastsUntil?: Moment[]; readsHolder?: boolean }
		| undefined;
	if (system?.escape) system.escape.dc = escapeDc(system.escape.dc, source.user);
	if (source.raises?.rules?.length) raiseRules(system?.rules, source.raises.rules);
	if (source.raises?.moments?.length && Array.isArray(system?.lastsUntil)) {
		system.lastsUntil = raiseMoments(system.lastsUntil, source.raises.moments);
	}
	if (!system?.readsHolder) resolveRuleFormulas(system?.rules, source.user);
	return {
		data,
		sourceItemUuid: source.itemUuid,
		sourceActorUuid: source.user?.uuid ?? null,
	};
}

/** A condition and its Lasts Until, for a card that has no effect on its item. */
export function payloadFromCondition(
	condition: string,
	lastsUntil: Moment[],
	source: { itemUuid: string | null; actorUuid: string | null },
): EffectPayload {
	return {
		data: { statuses: [condition], system: { lastsUntil } },
		sourceItemUuid: source.itemUuid,
		sourceActorUuid: source.actorUuid,
	};
}

async function documentOrUuid(uuid: string | null): Promise<{ uuid: string } | null> {
	if (!uuid) return null;
	const document = (await fromUuid(uuid as never)) as { uuid: string } | null;
	return document ?? { uuid };
}

/**
 * An effect with no status: the same effect from the same origin again keeps the one that lasts
 * longer. `stays` is the old one when it is kept.
 */
async function createPlainEffect(
	target: EffectHolder,
	data: Record<string, unknown>,
	origin: string | null,
	createOptions: Record<string, unknown> = {},
): Promise<{
	created: CreatedEffect | null;
	stays?: string;
	replaced?: Record<string, unknown>[];
}> {
	const ActiveEffectClass = CONFIG.ActiveEffect.documentClass as unknown as {
		create(data: object, options: object): Promise<CreatedEffect | undefined>;
		deleteDocuments(ids: string[], options: object): Promise<unknown>;
	};
	const current = origin
		? [...(target.effects ?? [])].filter(
				(effect) => effect.origin === origin && effect.name === data.name && !effect.statuses?.size,
			)
		: [];
	if (current.length) {
		const next = {
			lastsUntil: ((data.system as { lastsUntil?: Moment[] } | undefined)?.lastsUntil ??
				[]) as Moment[],
			duration: data.duration as { value?: number | null; units?: string | null } | null,
		};
		const context = { roundSeconds: roundSeconds(), secondsOf };
		if (!newApplicationLastsLonger(next, current.map(applicationOf), context)) {
			const kept = current[0];
			return { created: null, stays: kept.uuid ?? `${target.uuid}.ActiveEffect.${kept.id}` };
		}
		await ActiveEffectClass.deleteDocuments(
			current.map((effect) => effect.id).filter((id): id is string => !!id),
			{ parent: target, [CONDITION_REPLACED_OPTION]: true },
		);
	}
	const replaced = current.flatMap((effect): Record<string, unknown>[] => {
		const source = (effect as { toObject?(): Record<string, unknown> }).toObject?.();
		return source ? [source] : [];
	});
	const created = await ActiveEffectClass.create(
		{ ...data, origin, type: NIMBLE_EFFECT_TYPE },
		{
			parent: target,
			...createOptions,
			...(current.length ? { [EFFECT_RECREATED_OPTION]: true } : {}),
		},
	);
	return { created: created ?? null, ...(replaced.length ? { replaced } : {}) };
}

type SourceDocument = { uuid: string; getRollData?: () => Record<string, unknown> } | null;

interface StackItem {
	uuid?: string;
	effects?: {
		get(
			id: string,
		): ({ transfer?: boolean } & Parameters<typeof payloadFromEffect>[0]) | null | undefined;
	} | null;
}

/** The "At N stacks" effect: from the item of this application, else the item of the stacked effect. */
async function stackEffectPayload(
	effectId: string,
	items: { uuid?: string | null }[],
	payload: EffectPayload,
	sourceActor: SourceDocument,
): Promise<EffectPayload | null> {
	for (const each of items) {
		const item = (each.uuid ? await fromUuid(each.uuid as never) : null) as StackItem | null;
		const effect = itemEffectOf(item, effectId);
		if (!effect) continue;
		const user = sourceActor?.getRollData ? (sourceActor as SourceUser) : null;
		return {
			...payloadFromEffect(effect, { itemUuid: item?.uuid ?? null, user }),
			sourceActorUuid: payload.sourceActorUuid,
			cardId: payload.cardId ?? null,
		};
	}
	return null;
}

/** The count went past the "At N stacks" of the effect: the holder gains the item's effect. */
async function reachStack(
	target: EffectHolder,
	stacked: { name: string; count: number; origin: string | null; effectId: string },
	payload: EffectPayload,
	sourceActor: SourceDocument,
): Promise<StackReached> {
	const gained = await stackEffectPayload(
		stacked.effectId,
		[{ uuid: payload.sourceItemUuid }, { uuid: stacked.origin }],
		payload,
		sourceActor,
	);
	const reached: StackReached = {
		count: stacked.count,
		stackedName: stacked.name,
		gainedName: typeof gained?.data.name === 'string' ? gained.data.name : '',
	};
	if (!gained) return reached;
	if (typeof gained.data.img === 'string') reached.img = gained.data.img;
	if (!isRuleAutomationEnabled()) return { ...reached, payload: gained };
	const applied = await applyHere(target, gained);
	return applied ? { ...reached, gainedUuid: applied.effectUuid } : reached;
}

const holders = keyedQueue();

/**
 * Puts the effect on the target on this client. The user must own the target. The applications
 * on one target go one at a time, so no stack is lost.
 */
export function applyEffectHere(
	target: EffectHolder,
	payload: EffectPayload,
): Promise<AppliedEffect | null> {
	return holders.run(target.uuid, () => applyHere(target, payload));
}

async function applyHere(
	target: EffectHolder,
	payload: EffectPayload,
): Promise<AppliedEffect | null> {
	const [sourceItem, sourceActor] = await Promise.all([
		documentOrUuid(payload.sourceItemUuid),
		documentOrUuid(payload.sourceActorUuid),
	]);
	const data = payload.data;
	const grantsBefore = tempHpGrants(target);
	const statuses = Array.isArray(data.statuses) ? (data.statuses as string[]) : [];
	const lastsUntil = (data.system as { lastsUntil?: Moment[] } | undefined)?.lastsUntil ?? [];
	const createOptions = effectCardOption(payload.cardId);
	const stacking = stacksOf(data.system);
	const copy = stackingCopyOf(target, data);
	const before = copy ? (stacksOf(copy.system)?.count ?? 1) : 0;
	let effect: CreatedEffect | null;
	let replacedCopies: Record<string, unknown>[] = [];
	if (copy && !statuses.length) {
		await stackUp(
			copy,
			{ lastsUntil, duration: data.duration as StackingEffect['duration'] },
			createOptions,
		);
		effect = copy as CreatedEffect;
	} else if (statuses.length) {
		effect = (await applyConditionToActor(target as never, statuses[0], {
			sourceItem,
			sourceActor,
			lastsUntil,
			effectData: data,
			createOptions,
			onReplaced: (sources) => {
				replacedCopies = sources;
			},
		})) as CreatedEffect | null;
	} else {
		const plain = await createPlainEffect(
			target,
			data,
			sourceItem?.uuid ?? sourceActor?.uuid ?? null,
			createOptions,
		);
		if (plain.stays) return { effectUuid: plain.stays, actorName: target.name ?? '', stays: true };
		effect = plain.created;
		replacedCopies = plain.replaced ?? [];
	}
	if (!effect?.uuid) return null;
	const ids = new Set([...(target.effects ?? [])].map((entry) => entry.id));
	const replaced = grantsBefore
		.filter(([id]) => !ids.has(id))
		.reduce((sum, [, amount]) => sum + amount, 0);
	const grant = tempHpGrant(target, payload.tempHp, replaced);
	await giveTempHp(target, grant.give, effect.id ?? null);
	if (grant.owned) await effect.update?.({ 'system.tempHp': grant.owned });
	const applied: AppliedEffect = {
		effectUuid: effect.uuid,
		actorName: target.name ?? '',
		...(grant.refused ? { tempHpRefused: grant.refused } : {}),
		...(replacedCopies.length ? { replaced: replacedCopies } : {}),
	};
	if (!stacking) return applied;
	const count = effect === copy ? before + 1 : stacking.count;
	applied.stacks = count;
	const { at, effectId } = stacking;
	if (at === null || !effectId || before >= at || count < at) return applied;
	applied.stackReached = await reachStack(
		target,
		{
			name: typeof data.name === 'string' ? data.name : '',
			count,
			origin: copy?.origin ?? null,
			effectId,
		},
		payload,
		sourceActor,
	);
	await postStackGain(target, applied.stackReached, payload.cardId);
	return applied;
}

/** The temp HP that each effect on the target gave, by effect id. */
function tempHpGrants(target: EffectHolder): [string, number][] {
	return [...(target.effects ?? [])].flatMap((entry) => {
		const given = Number((entry as { system?: { tempHp?: number | null } }).system?.tempHp);
		return entry.id && Number.isFinite(given) && given > 0 ? [[entry.id, given]] : [];
	});
}

function isApplied(answer: unknown): answer is AppliedEffect {
	return typeof (answer as AppliedEffect | null)?.effectUuid === 'string';
}

/** Puts the effect on the target: here when the user owns it, else through the active GM. */
export async function applyEffectToActor(
	target: EffectHolder,
	payload: EffectPayload,
): Promise<AppliedEffect | null> {
	if (target.isOwner) return applyEffectHere(target, payload);
	const answer = await askActiveGm(QUERY_NAME, { targetUuid: target.uuid, payload });
	return isApplied(answer) ? answer : null;
}

export function registerApplyEffectQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<unknown>>;
		queries[QUERY_NAME] = async (data: { targetUuid: string; payload: EffectPayload }) => {
			const target = (await fromUuid(data.targetUuid as never)) as EffectHolder | null;
			if (!target) return null;
			return applyEffectHere(target, data.payload);
		};
	});
}
