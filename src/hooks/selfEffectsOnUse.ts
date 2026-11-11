import { systemHookName } from '#system';
import type { ApplyEffectNode, EffectNode } from '#types/effectTree.js';
import {
	appliedEffects,
	applyEffectFromCard,
	type EffectCard,
} from '#utils/chat/applyEffectFromCard.js';
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

/** The Apply Effect steps for the user of the item: at the root, or under the outcome the roll had. */
export function selfStepsOf(card: EffectCard): ApplyEffectNode[] {
	const system = (card.system ?? {}) as UseCardSystem;
	const tree = system.activation?.effects ?? [];
	return findNodesByContexts(tree, outcomesOf(system)).filter(
		(node): node is ApplyEffectNode => node.type === 'applyEffect' && node.recipient === 'self',
	);
}

/**
 * Puts each self step's effect on the user once the card exists. A step that did not take keeps
 * its button on the card. With Feature Effects off, every step keeps its button.
 */
export async function applySelfEffectsOnUse(card: EffectCard | null): Promise<void> {
	if (!card?.id || !isRuleAutomationEnabled()) return;
	for (const node of selfStepsOf(card)) {
		if (appliedEffects(card, node.id)?.length) continue;
		await applyEffectFromCard(card, node);
	}
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
