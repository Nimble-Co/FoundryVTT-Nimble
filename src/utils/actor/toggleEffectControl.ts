import { SYSTEM_ID } from '#system';
import {
	TOGGLE_EFFECT_ITEM_ID_FLAG,
	TOGGLE_EFFECT_RULE_ID_FLAG,
	type ToggleActorLike,
	type ToggleItemLike,
	turnToggleOn,
} from '#utils/actor/toggleEffectData.js';
import { buildEffectiveDicePoolMap } from '#utils/dicePool/helpers.js';
import localize from '#utils/localize.js';

/**
 * Helpers for the UI affordances that drive `toggleEffect` rules from outside
 * the rule pipeline (e.g. the on/off switch surfaced on attack-feature rows
 * in the heroic actions panel).
 *
 * These live in a plain TS module so the Svelte 5 compiler does not
 * instrument the Map iteration and effect lookup as reactive code (which
 * triggers a `store_invalid_shape` runtime error during sheet render).
 */

interface ToggleEffectRuleLike {
	type: string;
	id: string;
	identifier?: string;
	effectId?: string;
	disabled?: boolean;
	/** Confirm-end dialog content: plain text or an i18n key. Empty = no prompt. */
	confirmEndPrompt?: string;
	/** Pool identifiers to clear when this toggle ends. */
	clearPoolsOnEnd?: string[];
	/** Display label, used in the confirm dialog title. */
	label?: string;
}

interface ItemWithRules {
	rules?: { values: () => Iterable<unknown> } | Map<string, unknown>;
}

interface ToggleAELike {
	id: string;
	disabled: boolean;
}

interface ActorWithEffects {
	effects?: Iterable<{
		id: string;
		disabled: boolean;
		getFlag?: (scope: string, key: string) => unknown;
	}>;
}

/**
 * True when the AE is the backing effect of a toggleEffect rule. Used by the
 * conditions list to pull these out of the generic passive/temporary buckets
 * and into the active-toggles section, whose off switch routes through the
 * rule-owned toggle lifecycle instead of raw AE deletion.
 */
export function isToggleEffectAE(effect: {
	getFlag?: (scope: string, key: string) => unknown;
}): boolean {
	return Boolean(effect.getFlag?.(SYSTEM_ID, TOGGLE_EFFECT_RULE_ID_FLAG));
}

/**
 * Find the toggleEffect rule with the given id on the item. Unlike
 * findToggleEffectRule this matches disabled rules too: an AE left behind by
 * a since-disabled rule must still be endable through the normal path.
 */
export function findToggleEffectRuleById(
	item: ItemWithRules,
	ruleId: string,
): ToggleEffectRuleLike | null {
	const rules = item?.rules;
	if (!rules || typeof (rules as { values?: () => unknown }).values !== 'function') return null;
	for (const rule of (rules as { values: () => Iterable<unknown> }).values()) {
		const r = rule as ToggleEffectRuleLike;
		if (r?.type === 'toggleEffect' && r.id === ruleId) return r;
	}
	return null;
}

export function findToggleEffectRule(item: ItemWithRules): ToggleEffectRuleLike | null {
	const rules = item?.rules;
	if (!rules || typeof (rules as { values?: () => unknown }).values !== 'function') return null;
	for (const rule of (rules as { values: () => Iterable<unknown> }).values()) {
		const r = rule as ToggleEffectRuleLike;
		if (r?.type === 'toggleEffect' && !r.disabled) return r;
	}
	return null;
}

export function findToggleEffectAE(
	actor: ActorWithEffects | null | undefined,
	ruleId: string,
): ToggleAELike | null {
	const effects = actor?.effects;
	if (!effects) return null;
	for (const effect of effects) {
		if (effect.getFlag?.(SYSTEM_ID, TOGGLE_EFFECT_RULE_ID_FLAG) === ruleId) return effect;
	}
	return null;
}

type ItemForToggle = ToggleItemLike;

type ActorForToggle = ActorWithEffects & ToggleActorLike;

/**
 * Returns true if any pool listed in `clearPoolsOnEnd` currently has dice
 * faces (i.e. the player would actually lose something by ending the
 * toggle). When every pool is empty there's nothing to lose, so we skip the
 * confirm prompt entirely (no need to interrupt for a no-op).
 */
function hasPoolContentToLose(actor: ActorForToggle, poolIds: string[] | undefined): boolean {
	if (!poolIds || poolIds.length < 1) return false;
	const pools = buildEffectiveDicePoolMap(
		actor as unknown as Parameters<typeof buildEffectiveDicePoolMap>[0],
	);
	for (const poolId of poolIds) {
		const trimmed = (poolId ?? '').trim();
		if (trimmed.length < 1) continue;
		if ((pools[trimmed]?.faces?.length ?? 0) > 0) return true;
	}
	return false;
}

/**
 * Player-initiated toggle off. When the rule sets `confirmEndPrompt` AND at
 * least one of the linked pools has dice to lose, show a confirm dialog first
 * so a misclick doesn't silently drop a long-running effect. The delete hook
 * clears the `clearPoolsOnEnd` pools.
 *
 * Returns true if the toggle was ended, false if the user cancelled.
 */
export async function endToggleEffect(
	actor: ActorForToggle,
	item: ItemForToggle,
	rule: ToggleEffectRuleLike,
): Promise<boolean> {
	const existing = findToggleEffectAE(actor, rule.id);
	if (!existing) return true;
	if (existing.disabled) {
		await actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
		return true;
	}

	const prompt = rule.confirmEndPrompt?.trim() ?? '';
	const shouldPrompt = prompt.length > 0 && hasPoolContentToLose(actor, rule.clearPoolsOnEnd);
	if (shouldPrompt) {
		// The prompt accepts either a localization key or plain text, so
		// homebrew items can set one without shipping translation files.
		const promptText = game.i18n?.has?.(prompt) ? localize(prompt) : prompt;
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: {
				title: localize('NIMBLE.rules.toggleEffect.confirmDialogTitle', {
					name: rule.label || item.name,
				}),
			},
			content: `<p>${promptText}</p>`,
			yes: { label: localize('NIMBLE.rules.toggleEffect.confirmDialogConfirm') },
			no: { label: localize('NIMBLE.rules.toggleEffect.confirmDialogCancel') },
			rejectClose: false,
		});
		if (confirmed !== true) return false;
	}

	await actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
	return true;
}

/**
 * Flip the toggle: on when it has no effect or its effect is off, else end it.
 * Returns false if the user cancelled the confirm prompt of an end, true otherwise.
 */
export async function toggleEffectAE(
	actor: ActorForToggle,
	item: ItemForToggle,
	rule: ToggleEffectRuleLike,
): Promise<boolean> {
	const existing = findToggleEffectAE(actor, rule.id);
	if (!existing || existing.disabled) {
		await turnToggleOn(actor, item, rule);
		return true;
	}
	return endToggleEffect(actor, item, rule);
}

interface ActorWithItems extends ActorForToggle {
	items?: { get: (id: string) => (ItemForToggle & ItemWithRules) | null | undefined };
}

/**
 * End a toggle starting from its backing AE (the conditions-list off switch).
 * Resolves the owning item and rule from the AE's flags so the confirm prompt
 * behaves exactly like the action-row switch. When the owning item or rule no
 * longer exists, deletes the AE directly.
 *
 * Returns true if the toggle was ended, false if the user cancelled.
 */
export async function endToggleEffectFromAE(
	actor: ActorWithItems,
	effect: { id: string; getFlag?: (scope: string, key: string) => unknown },
): Promise<boolean> {
	const ruleId = effect.getFlag?.(SYSTEM_ID, TOGGLE_EFFECT_RULE_ID_FLAG);
	const itemId = effect.getFlag?.(SYSTEM_ID, TOGGLE_EFFECT_ITEM_ID_FLAG);
	const item = typeof itemId === 'string' ? actor.items?.get(itemId) : null;
	const rule = item && typeof ruleId === 'string' ? findToggleEffectRuleById(item, ruleId) : null;

	if (!item || !rule) {
		await actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
		return true;
	}

	return endToggleEffect(actor, item, rule);
}
