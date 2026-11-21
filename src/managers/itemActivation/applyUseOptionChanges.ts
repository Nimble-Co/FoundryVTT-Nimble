import type { ApplyEffectNode } from '#types/effectTree.js';
import type { UseOptionEffect } from '#types/useOption.d.ts';
import type { ChosenUseOptions } from '../../utils/spell/spellUseOptions.js';

interface OptionActivation {
	effects?: unknown[];
	targets?: { distance?: number } | null;
}

type NodeVisitor = (node: Record<string, unknown>) => void;

/** Visit each effect node of the tree, nested ones too. */
function eachEffectNode(value: unknown, visit: NodeVisitor): void {
	if (Array.isArray(value)) {
		for (const each of value) eachEffectNode(each, visit);
		return;
	}
	if (!value || typeof value !== 'object') return;
	const node = value as Record<string, unknown>;
	if (typeof node.type !== 'string') {
		// A list of nodes by context, such as `on` or `failedSaveBy`.
		for (const each of Object.values(node)) eachEffectNode(each, visit);
		return;
	}
	visit(node);
	eachEffectNode(node.on, visit);
	eachEffectNode(node.sharedRolls, visit);
}

/** Put the changes of the options the player turned on into the activation of the cast. */
export function applyUseOptionChanges(
	activation: OptionActivation | null | undefined,
	chosen: ChosenUseOptions,
): void {
	if (!activation) return;
	if (chosen.range > 0 && activation.targets) {
		activation.targets.distance = (activation.targets.distance || 0) + chosen.range;
	}
	if (chosen.damageType) {
		eachEffectNode(activation.effects, (node) => {
			if (node.type === 'damage') node.damageType = chosen.damageType;
		});
	}
	if (chosen.effects.length > 0) {
		activation.effects = [...(activation.effects ?? []), ...chosen.effects.map(selfStepOf)];
	}
}

/** A step of the card that gives the caster an effect of the option's item. */
function selfStepOf({ itemUuid, effectId }: UseOptionEffect, index: number): ApplyEffectNode {
	return {
		id: `useOption${index}${effectId}`,
		type: 'applyEffect',
		effectId,
		effectItemUuid: itemUuid,
		recipient: 'self',
		parentContext: null,
		parentNode: null,
	};
}
