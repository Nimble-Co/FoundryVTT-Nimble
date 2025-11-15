import { createConditionNode } from './createConditionNode';
import { createDamageNode } from './createDamageNode';
import { createDamageOutcomeNode } from './createDamageOutcomeNode';
import { createHealingNode } from './createHealingNode';
import { createSavingThrowNode } from './createSavingThrowNode';
import { createTextNode } from './createTextNode';
import { flattenEffectsTree } from './flattenEffectsTree';
import { reconstructEffectsTree } from './reconstructEffectsTree';
import type { NimbleBoonItem } from '../../documents/item/boon';
import type { EffectNode } from '#types/effectTree';

export async function createEffectNode(
	document: NimbleBoonItem,
	effectsTree: EffectNode[],
	nodeType: string,
	event: Event,
	context: string,
): Promise<void> {
	let newNode: EffectNode;

	const flattened: EffectNode[] = flattenEffectsTree(effectsTree);
	const targetElement = event.target as HTMLElement | null;
	if (!targetElement) return;

	const parentElement: HTMLElement | null = targetElement.closest('[data-node-id]');
	const parentId = parentElement?.dataset?.nodeId ?? null;
	const parentNode = flattened.find((node) => node.id === parentId);

	if (!nodeType) return;

	if (nodeType === 'condition') newNode = createConditionNode(parentId, context);
	else if (nodeType === 'damage') newNode = createDamageNode(parentId, context);
	else if (nodeType === 'damageOutcome') newNode = createDamageOutcomeNode(parentId!, context);
	else if (nodeType === 'healing') newNode = createHealingNode(parentId, context);
	else if (nodeType === 'note') newNode = createTextNode(parentId, context);
	else if (nodeType === 'savingThrow') newNode = createSavingThrowNode(parentId, context);
	else throw new Error('Invalid node type');

	newNode.parentNode = parentId ?? null;
	newNode.parentContext = context ?? null;

	if (
		parentNode?.type === 'savingThrow' &&
		context === 'sharedRolls' &&
		newNode.type === 'damage'
	) {
		parentNode.sharedRolls ??= [];
		parentNode.sharedRolls.push(newNode);
	}

	if (parentNode?.type === 'damage' || parentNode?.type === 'savingThrow') {
		parentNode.on ??= {};

		if (context !== 'sharedRolls') {
			parentNode.on[context] ??= [];
			parentNode.on[context].push(newNode);
		}
	} else {
		flattened.push(newNode);
	}

	document.update({
		'system.activation.effects': reconstructEffectsTree(flattened),
	});

	const creationButtons = targetElement.closest('div');
	if (creationButtons) {
		creationButtons.style.display = 'none';
	}
}
