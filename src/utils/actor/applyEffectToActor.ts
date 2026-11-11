import { SYSTEM_ID } from '#system';
import { askActiveGm } from '#utils/askActiveGm.js';
import { newApplicationLastsLonger } from '#utils/lastsUntil/lastsLonger.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { roundSeconds, secondsOf } from '#utils/lastsUntil/secondsOf.js';
import { checkFormulaReferences } from '#utils/rolls/formulaReferences.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';
import applyConditionToActor, {
	applicationOf,
	CONDITION_REPLACED_OPTION,
	type ExistingConditionEffect,
} from './applyConditionToActor.js';
import { giveTempHp, tempHpGrant } from './effectTempHp.js';

const QUERY_NAME = `${SYSTEM_ID}.applyEffect`;

/** Fields of the item's effect that the copy on the holder does not keep. */
const NOT_COPIED = ['_id', '_stats', 'origin', 'start', 'transfer', 'disabled', 'sort', 'folder'];

/** What puts one effect on one actor. It goes to the GM as it is, so it holds only plain data. */
export interface EffectPayload {
	/** Active Effect source data: name, img, description, statuses, duration, system. */
	data: Record<string, unknown>;
	sourceItemUuid: string | null;
	sourceActorUuid: string | null;
	/** The temp HP that the effect gives, from a temp healing roll of the card. */
	tempHp?: number | null;
}

export interface AppliedEffect {
	effectUuid: string;
	actorName: string;
	/** the holder kept more temp HP than the effect gives */
	tempHpRefused?: { temp: number; amount: number };
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
	effects?: Iterable<ExistingConditionEffect & { origin?: string | null; name?: string | null }>;
}

interface CreatedEffect {
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

/** The `@` references of each extra damage formula, from the roll data of the one who used the item. */
function resolveExtraDamage(rules: unknown, user: SourceUser | null): void {
	if (!user || !Array.isArray(rules)) return;
	let rollData: Record<string, unknown> | null = null;
	for (const rule of rules as { type?: string; heldKind?: string; formula?: unknown }[]) {
		if (rule?.type !== 'heldRoll' || rule.heldKind !== 'extraDamage') continue;
		if (typeof rule.formula !== 'string' || !rule.formula.includes('@')) continue;
		rollData ??= user.getRollData();
		checkFormulaReferences(rule.formula, user, {}, { rollData });
		// A reference the source has no value for is 0 here, not the holder's value at the roll.
		rule.formula = Roll.replaceFormulaData(rule.formula, rollData, { missing: '0' });
	}
}

/** A copy of an item's effect for an actor. The Escape DC and the extra damage dice are worked out now. */
export function payloadFromEffect(
	effect: { toObject(): Record<string, unknown> },
	source: { itemUuid: string | null; user: SourceUser | null },
): EffectPayload {
	const data = foundry.utils.deepClone(effect.toObject());
	for (const key of NOT_COPIED) delete data[key];
	const system = data.system as { escape?: { dc?: unknown }; rules?: unknown } | undefined;
	if (system?.escape) system.escape.dc = escapeDc(system.escape.dc, source.user);
	resolveExtraDamage(system?.rules, source.user);
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

/** An effect with no status: the same effect from the same origin again keeps the one that lasts longer. */
async function createPlainEffect(
	target: EffectHolder,
	data: Record<string, unknown>,
	origin: string | null,
): Promise<CreatedEffect | null> {
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
		if (!newApplicationLastsLonger(next, current.map(applicationOf), context)) return null;
		await ActiveEffectClass.deleteDocuments(
			current.map((effect) => effect.id).filter((id): id is string => !!id),
			{ parent: target, [CONDITION_REPLACED_OPTION]: true },
		);
	}
	return (
		(await ActiveEffectClass.create(
			{ ...data, origin, type: NIMBLE_EFFECT_TYPE },
			{ parent: target },
		)) ?? null
	);
}

/** Puts the effect on the target on this client. The user must own the target. */
export async function applyEffectHere(
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
	const effect = statuses.length
		? ((await applyConditionToActor(target as never, statuses[0], {
				sourceItem,
				sourceActor,
				lastsUntil,
				effectData: data,
			})) as CreatedEffect | null)
		: await createPlainEffect(target, data, sourceItem?.uuid ?? sourceActor?.uuid ?? null);
	if (!effect?.uuid) return null;
	const ids = new Set([...(target.effects ?? [])].map((entry) => entry.id));
	const replaced = grantsBefore
		.filter(([id]) => !ids.has(id))
		.reduce((sum, [, amount]) => sum + amount, 0);
	const grant = tempHpGrant(target, payload.tempHp, replaced);
	await giveTempHp(target, grant.give);
	if (grant.owned) await effect.update?.({ 'system.tempHp': grant.owned });
	return {
		effectUuid: effect.uuid,
		actorName: target.name ?? '',
		...(grant.refused ? { tempHpRefused: grant.refused } : {}),
	};
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
