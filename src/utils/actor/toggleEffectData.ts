import { SYSTEM_ID } from '#system';
import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { payloadFromEffect } from '#utils/actor/applyEffectToActor.js';
import { itemEffectOf } from '#utils/actor/itemEffectOf.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';

export const TOGGLE_EFFECT_RULE_ID_FLAG = 'toggleEffectRuleId';
export const TOGGLE_EFFECT_ITEM_ID_FLAG = 'toggleEffectItemId';

/** The parts of a toggleEffect rule that make its effect. */
export interface ToggleRuleLike {
	id: string;
	identifier?: string;
	label?: string;
	effectId?: string;
}

interface RuleLike {
	type?: string;
	disabled?: boolean;
	toggleIdentifier?: string;
	appliesTo?: () => boolean;
}

interface ActorWithRules {
	items?: { contents?: Array<{ rules?: { values: () => Iterable<unknown> } }> } | null;
}

interface SourceActor extends ActorWithRules {
	type: string;
	uuid?: string | null;
	getRollData(): Record<string, unknown>;
}

export interface ToggleItemLike {
	id: string | null;
	name: string;
	img?: string | null;
	uuid?: string;
	actor?: unknown;
	effects?: {
		get(id: string): { transfer?: boolean; toObject(): Record<string, unknown> } | undefined | null;
	} | null;
}

interface ToggleEffectLike {
	id: string | null;
	disabled: boolean;
	getFlag?: (scope: string, key: string) => unknown;
}

export interface ToggleActorLike {
	effects?: Iterable<ToggleEffectLike> | null;
	createEmbeddedDocuments(type: 'ActiveEffect', data: Record<string, unknown>[]): Promise<unknown>;
	deleteEmbeddedDocuments(
		type: 'ActiveEffect',
		ids: string[],
		operation?: Record<string, unknown>,
	): Promise<unknown>;
}

/** The live Modify Toggle rules of the actor that target this toggle (by identifier or id). */
export function modifyToggleRulesFor<R extends object>(
	actor: ActorWithRules | null | undefined,
	rule: ToggleRuleLike,
): Array<R & RuleLike> {
	const targetIds = new Set([rule.identifier, rule.id].filter((id): id is string => !!id));
	const found: Array<R & RuleLike> = [];
	for (const item of actor?.items?.contents ?? []) {
		const rules = item.rules;
		if (!rules || typeof rules.values !== 'function') continue;
		for (const entry of rules.values()) {
			const modifier = entry as R & RuleLike;
			if (modifier.type !== 'modifyToggle' || modifier.disabled) continue;
			if (!targetIds.has(modifier.toggleIdentifier?.trim() ?? '')) continue;
			if (typeof modifier.appliesTo === 'function' && !modifier.appliesTo()) continue;
			found.push(modifier);
		}
	}
	return found;
}

function droppedEvents(
	actor: ActorWithRules | null | undefined,
	rule: ToggleRuleLike,
): Set<string> {
	const modifiers = modifyToggleRulesFor<{ dropMoments?: string[] }>(actor, rule);
	return new Set(modifiers.flatMap((modifier) => modifier.dropMoments ?? []));
}

/**
 * The data of the toggle's effect on the actor. With an item effect: a copy of it, minus the event
 * moments that the actor's Modify Toggle rules drop. With none: a blank effect named for the toggle.
 */
function toggleEffectData(item: ToggleItemLike, rule: ToggleRuleLike): Record<string, unknown> {
	const toggleFlags = {
		[TOGGLE_EFFECT_RULE_ID_FLAG]: rule.id,
		[TOGGLE_EFFECT_ITEM_ID_FLAG]: item.id,
	};
	const effect = itemEffectOf(item, rule.effectId);
	if (!effect) {
		return {
			type: NIMBLE_EFFECT_TYPE,
			name: rule.label || item.name,
			img: item.img,
			disabled: false,
			origin: item.uuid,
			flags: { [SYSTEM_ID]: toggleFlags },
		};
	}

	const actor = (item.actor ?? null) as SourceActor | null;
	const { data } = payloadFromEffect(effect, { itemUuid: item.uuid ?? null, user: actor });
	const dropped = droppedEvents(actor, rule);
	const system = (data.system ?? {}) as { lastsUntil?: Moment[] };
	system.lastsUntil = (system.lastsUntil ?? []).filter(
		(moment) => !(moment.kind === 'event' && moment.event && dropped.has(moment.event)),
	);
	const flags = (data.flags ?? {}) as Record<string, Record<string, unknown>>;
	return {
		...data,
		system,
		type: NIMBLE_EFFECT_TYPE,
		origin: item.uuid,
		disabled: false,
		flags: { ...flags, [SYSTEM_ID]: { ...(flags[SYSTEM_ID] ?? {}), ...toggleFlags } },
	};
}

/** The actor's effect of this toggle, on or off. */
export function findToggleEffect<E extends ToggleEffectLike>(
	actor: { effects?: Iterable<E> | null } | null | undefined,
	ruleId: string,
): E | null {
	for (const effect of actor?.effects ?? []) {
		if (effect.getFlag?.(SYSTEM_ID, TOGGLE_EFFECT_RULE_ID_FLAG) === ruleId) return effect;
	}
	return null;
}

/**
 * Turn the toggle on. An effect that is off is replaced by a new copy, so it starts again. Returns
 * false when the toggle was already on.
 */
export async function turnToggleOn(
	actor: ToggleActorLike,
	item: ToggleItemLike,
	rule: ToggleRuleLike,
): Promise<boolean> {
	const existing = findToggleEffect(actor, rule.id);
	if (existing && !existing.disabled) return false;
	if (existing?.id) {
		// A replace is not an end: the pools stay and no "effect ends" moment fires.
		await actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id], {
			[CONDITION_REPLACED_OPTION]: true,
		});
	}
	await actor.createEmbeddedDocuments('ActiveEffect', [toggleEffectData(item, rule)]);
	return true;
}
