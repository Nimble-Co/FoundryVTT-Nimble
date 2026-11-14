import { systemHookName } from '#system';
import type {
	ApplyEffectNode,
	EffectNode,
	EndConditionsNode,
	WoundNode,
} from '#types/effectTree.js';
import {
	appliedEffects,
	applyEffectFromCard,
	type EffectCard,
} from '#utils/chat/applyEffectFromCard.js';
import { endConditionsFromCard, endedConditions } from '#utils/chat/endConditionsFromCard.js';
import { appliedWounds, giveWoundsFromCard } from '#utils/chat/woundFromCard.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { findNodesByContexts } from '#utils/treeManipulation/findNodesByContexts.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

interface UseCardSystem {
	activation?: { effects?: EffectNode[] } | null;
	isCritical?: boolean;
	isMiss?: boolean;
}

/** The outcome branches of the card's roll, as the card shows them. */
function outcomesOf(system: UseCardSystem): string[] {
	if (system.isCritical) return ['criticalHit', 'hit'];
	if (system.isMiss) return ['miss'];
	return ['hit'];
}

export type SelfStep = ApplyEffectNode | EndConditionsNode | WoundNode;

const SELF_STEP_TYPES = new Set(['applyEffect', 'endConditions', 'wound']);

/**
 * The Apply Effect, Wound and End Conditions steps for the user: at the root, or under the roll's
 * outcome. A step that waits for its button is not one.
 */
export function selfStepsOf(card: EffectCard): SelfStep[] {
	const system = (card.system ?? {}) as UseCardSystem;
	const tree = system.activation?.effects ?? [];
	return findNodesByContexts(tree, outcomesOf(system)).filter(
		(node): node is SelfStep =>
			SELF_STEP_TYPES.has(node.type) &&
			(node as SelfStep).recipient === 'self' &&
			!(node.type === 'applyEffect' && node.waitsForClick),
	);
}

const steps = keyedQueue();

/** Applies one self step, unless the card shows that it already did. */
export function applySelfStep(card: EffectCard, node: SelfStep): Promise<void> {
	if (!card.id) return applyStepOnce(card, node);
	return steps.run(`${card.id}:${node.id}`, () => applyStepOnce(card, node));
}

async function applyStepOnce(card: EffectCard, node: SelfStep): Promise<void> {
	if (node.type === 'endConditions') {
		if (Object.keys(endedConditions(card, node.id) ?? {}).length) return;
		await endConditionsFromCard(card, node);
		return;
	}
	if (node.type === 'wound') {
		if (Object.keys(appliedWounds(card, node.id) ?? {}).length) return;
		await giveWoundsFromCard(card, node);
		return;
	}
	if (appliedEffects(card, node.id)?.length) return;
	await applyEffectFromCard(card, node);
}

/**
 * Applies each self step to the user once the card exists. A step that did not take keeps its
 * button on the card. With Feature Effects off, every step keeps its button.
 */
export async function applySelfEffectsOnUse(card: EffectCard | null): Promise<void> {
	if (!card?.id || !isRuleAutomationEnabled()) return;
	for (const node of selfStepsOf(card)) await applySelfStep(card, node);
}

let registered = false;

/** `useItem` fires on the client that used the item, so the card's author applies the effects. */
export function registerSelfEffectsOnUseHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on(
		systemHookName('useItem') as never,
		((_item: unknown, card: EffectCard | null) => {
			void applySelfEffectsOnUse(card).catch((error) => {
				console.error('Nimble | Could not apply the effects of the item to its user.', error);
			});
		}) as never,
	);
}
