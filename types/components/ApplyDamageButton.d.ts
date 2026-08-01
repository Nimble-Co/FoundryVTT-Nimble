import type { EffectNode } from '#types/effectTree.js';

export interface ApplyDamageButtonProps {
	/** The card's damage group, used only for the disposition hint */
	nodes: Array<EffectNode & { targetDisposition?: 'friendly' | 'neutral' | 'hostile' | 'secret' }>;
}
