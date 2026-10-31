/**
 * The plain copies of Foundry documents that both sheet adapters give the view model.
 * Only the adapters import this file: it reads Foundry.
 */
import { SYSTEM_ID } from '#system';
import { deriveDurationDetails, expandDurationLabel, NO_END_LABEL } from '#utils/formatDuration.js';
import localize from '#utils/localize.js';
import type { ActorCondition } from '#view/dataPreparationHelpers/prepareActorConditions.js';
import getDeterministicBonus from '../../../dice/getDeterministicBonus.js';
import {
	TOGGLE_EFFECT_ITEM_ID_FLAG,
	TOGGLE_EFFECT_RULE_ID_FLAG,
} from '../../../models/rules/toggleEffect.js';
import { CONDITIONS_CHANGED_HOOK } from '../../../settings/customConditionSettings.js';
import { plainText } from './plainText.ts';
import type { ConditionLike, EffectLike, ItemLike, RuleLike } from './sheetSource.ts';

type AnyRecord = Record<string, unknown>;

interface RollDataSource {
	getRollData(): Parameters<typeof getDeterministicBonus>[1];
}

/** Item effects and the condition list are not on `actor.reactive`, so these hooks redraw them. */
export const EFFECT_HOOKS = [
	'createActiveEffect',
	'updateActiveEffect',
	'deleteActiveEffect',
	CONDITIONS_CHANGED_HOOK,
];

/** Calls the listener on each hook; the function that it gives back stops that. */
export function registerRedrawHooks(names: string[], listener: () => void): () => void {
	const hooks = Hooks as unknown as {
		on: (hook: string, listener: () => void) => number;
		off: (hook: string, id: number) => void;
	};
	const ids = names.map((name) => [name, hooks.on(name, listener)] as const);
	return () => {
		for (const [name, id] of ids) hooks.off(name, id);
	};
}

function ruleLike(
	rule: AnyRecord & { appliesTo?: () => boolean; toObject?: () => AnyRecord },
	actor: RollDataSource,
): RuleLike {
	const fields = rule.toObject?.() ?? {};
	const value = fields.value;
	let amount: number | undefined;
	if (typeof value === 'number') amount = value;
	else if (typeof value === 'string' && value.trim()) {
		amount = getDeterministicBonus(value, actor.getRollData()) ?? undefined;
	}
	return {
		id: String(rule.id ?? ''),
		type: String(rule.type ?? ''),
		active: rule.disabled !== true && (rule.appliesTo?.() ?? true),
		amount,
		fields,
	};
}

export function itemLike(item: Item, actor: RollDataSource): ItemLike {
	const rules = (item as unknown as { rules?: Map<string, AnyRecord> }).rules;
	return {
		id: item.id ?? '',
		uuid: item.uuid ?? '',
		name: item.name ?? '',
		img: item.img ?? '',
		type: item.type,
		system: item.system as unknown as AnyRecord,
		rules: rules ? [...rules.values()].map((rule) => ruleLike(rule, actor)) : [],
	};
}

export type EffectDocument = ActiveEffect & {
	parent?: { documentName?: string; id?: string | null } | null;
	isTemporary?: boolean;
	description?: string;
	duration?: Parameters<typeof deriveDurationDetails>[0];
};

/** Same split as the old Conditions tab: an effect that no item keeps on is temporary. */
function isTemporary(effect: EffectDocument, fromItem: boolean): boolean {
	if (!fromItem) return true;
	if (typeof effect.isTemporary === 'boolean') return effect.isTemporary;
	const duration = effect.duration as { remaining?: number; rounds?: number } | undefined;
	return (
		typeof duration?.remaining === 'number' ||
		(typeof duration?.rounds === 'number' && duration.rounds > 0)
	);
}

function durationWords(label: string): string {
	return label === NO_END_LABEL ? '' : expandDurationLabel(label, (key) => localize(key));
}

export function effectLike(effect: EffectDocument): EffectLike {
	const itemId = effect.parent?.documentName === 'Item' ? (effect.parent.id ?? null) : null;
	const ruleId = effect.getFlag?.(SYSTEM_ID as 'core', TOGGLE_EFFECT_RULE_ID_FLAG as never);
	const toggleItemId = effect.getFlag?.(SYSTEM_ID as 'core', TOGGLE_EFFECT_ITEM_ID_FLAG as never);
	return {
		id: effect.id ?? '',
		name: effect.name ?? '',
		img: effect.img ?? '',
		disabled: effect.disabled === true,
		statuses: [...(effect.statuses ?? [])],
		origin: (effect.origin as string | null) ?? null,
		itemId,
		toggle:
			typeof ruleId === 'string'
				? { itemId: typeof toggleItemId === 'string' ? toggleItemId : '', ruleId }
				: null,
		temporary: isTemporary(effect, !!itemId || !!effect.origin),
		duration: durationWords(deriveDurationDetails(effect.duration).label),
		description: plainText(effect.description ?? ''),
	};
}

export function conditionLike(condition: ActorCondition): ConditionLike {
	return {
		id: condition.id,
		name: condition.name,
		img: condition.img,
		active: condition.active,
		description: plainText(condition.descriptionHtml),
		duration: durationWords(condition.durationLabel),
		source: condition.active ? (condition.originName ?? '') : '',
	};
}
