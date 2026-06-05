import { SYSTEM_ID } from '#system';
import { setPoolFaces } from './dicePool/dicePoolRefill.js';
import { buildEffectiveDicePoolMap } from './dicePool/helpers.js';
import localize from './localize.js';

/**
 * Helpers for the UI affordances that drive `toggleEffect` rules from outside
 * the rule pipeline — e.g. the on/off switch surfaced on attack-feature rows
 * in the heroic actions panel.
 *
 * These live in a plain TS module so the Svelte 5 compiler does not
 * instrument the Map iteration and effect lookup as reactive code (which
 * triggers a `store_invalid_shape` runtime error during sheet render).
 */

interface ToggleEffectRuleLike {
	type: string;
	id: string;
	disabled?: boolean;
	/** i18n key for the confirm-end dialog content. Empty = no prompt. */
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
		if (effect.getFlag?.(SYSTEM_ID, 'toggleEffectRuleId') === ruleId) return effect;
	}
	return null;
}

interface ItemForToggle {
	id: string;
	name: string;
	img?: string;
	uuid?: string;
}

interface ActorForToggle extends ActorWithEffects {
	createEmbeddedDocuments: (type: string, data: unknown[]) => Promise<unknown[]>;
	deleteEmbeddedDocuments: (type: string, ids: string[]) => Promise<unknown[]>;
}

async function createToggleEffectAE(
	actor: ActorForToggle,
	item: ItemForToggle,
	ruleId: string,
): Promise<void> {
	await actor.createEmbeddedDocuments('ActiveEffect', [
		{
			name: item.name,
			img: item.img,
			disabled: false,
			origin: item.uuid,
			flags: {
				[SYSTEM_ID]: {
					toggleEffectRuleId: ruleId,
					toggleEffectItemId: item.id,
				},
			},
		},
	]);
}

/**
 * Player-initiated toggle off (from the on/off switch). When the rule sets
 * `confirmEndPrompt`, show a confirm dialog first so a misclick doesn't
 * silently drop a long-running effect. On confirm (or when no prompt is
 * set) clear any pools listed in `clearPoolsOnEnd` then delete the AE.
 *
 * Returns true if the toggle was ended, false if the user cancelled.
 */
/**
 * Returns true if any pool listed in `clearPoolsOnEnd` currently has dice
 * faces — i.e. the player would actually lose something by ending the
 * toggle. When every pool is empty there's nothing to lose, so we skip the
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

async function disableToggleEffect(
	actor: ActorForToggle,
	item: ItemForToggle,
	rule: ToggleEffectRuleLike,
): Promise<boolean> {
	const existing = findToggleEffectAE(actor, rule.id);
	if (!existing) return true;

	const promptKey = rule.confirmEndPrompt?.trim() ?? '';
	const shouldPrompt = promptKey.length > 0 && hasPoolContentToLose(actor, rule.clearPoolsOnEnd);
	if (shouldPrompt) {
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: {
				title: localize('NIMBLE.rules.toggleEffect.confirmDialogTitle', {
					name: rule.label || item.name,
				}),
			},
			content: `<p>${localize(promptKey)}</p>`,
			yes: { label: localize('NIMBLE.rules.toggleEffect.confirmDialogConfirm') },
			no: { label: localize('NIMBLE.rules.toggleEffect.confirmDialogCancel') },
			rejectClose: false,
		});
		if (confirmed !== true) return false;
	}

	for (const poolId of rule.clearPoolsOnEnd ?? []) {
		const trimmed = (poolId ?? '').trim();
		if (trimmed.length < 1) continue;
		await setPoolFaces(actor as unknown as Actor, trimmed, []);
	}

	await actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
	return true;
}

/**
 * Flip the AE on or off based on its current state. Wraps create / disable
 * so the switch can call a single entry point. Returns false if the user
 * cancelled the confirm prompt during a disable, true otherwise.
 */
export async function toggleEffectAE(
	actor: ActorForToggle,
	item: ItemForToggle,
	rule: ToggleEffectRuleLike,
): Promise<boolean> {
	const existing = findToggleEffectAE(actor, rule.id);
	if (!existing) {
		await createToggleEffectAE(actor, item, rule.id);
		return true;
	}
	return disableToggleEffect(actor, item, rule);
}
