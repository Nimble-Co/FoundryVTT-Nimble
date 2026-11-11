import { SYSTEM_ID } from '#system';
import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { findToggleEffectRuleById } from '#utils/actor/toggleEffectControl.js';
import {
	TOGGLE_EFFECT_ITEM_ID_FLAG,
	TOGGLE_EFFECT_RULE_ID_FLAG,
} from '#utils/actor/toggleEffectData.js';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { isActiveGM } from '#utils/isActiveGM.js';

interface DeletedEffect {
	parent?: unknown;
	getFlag?: (scope: string, key: string) => unknown;
}

interface ToggleHolder {
	items?: { get(id: string): unknown } | null;
}

/**
 * A toggle effect that is deleted by any path empties the pools its rule lists in
 * `clearPoolsOnEnd`. It runs on the active GM only, so once. A replace is not an end.
 */
export async function clearPoolsOfEndedToggle(
	effect: DeletedEffect,
	options?: Record<string, unknown>,
): Promise<void> {
	if (!isActiveGM() || options?.[CONDITION_REPLACED_OPTION]) return;
	if (!(effect.parent instanceof Actor)) return;
	const ruleId = effect.getFlag?.(SYSTEM_ID, TOGGLE_EFFECT_RULE_ID_FLAG);
	const itemId = effect.getFlag?.(SYSTEM_ID, TOGGLE_EFFECT_ITEM_ID_FLAG);
	if (typeof ruleId !== 'string' || typeof itemId !== 'string') return;
	const actor = effect.parent as unknown as ToggleHolder;
	const item = actor.items?.get(itemId);
	if (!item) return;
	const rule = findToggleEffectRuleById(item as never, ruleId);
	for (const poolId of rule?.clearPoolsOnEnd ?? []) {
		const trimmed = (poolId ?? '').trim();
		if (trimmed) await setPoolFaces(actor as unknown as Actor, trimmed, []);
	}
}

let registered = false;

export default function registerToggleEffectEndHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('deleteActiveEffect', (effect, options) => {
		void clearPoolsOfEndedToggle(
			effect as unknown as DeletedEffect,
			options as unknown as Record<string, unknown>,
		);
	});
}
