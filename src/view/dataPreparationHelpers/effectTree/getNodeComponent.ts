import ConditionNode from '../../chat/components/ConditionNode.svelte';
import DamageNode from '../../chat/components/DamageNode.svelte';
import DamageOutcomeNode from '../../chat/components/DamageOutcomeNode.svelte';
import HealingNode from '../../chat/components/HealingNode.svelte';
import PoolNode from '../../chat/components/PoolNode.svelte';
import SavingThrowNode from '../../chat/components/SavingThrowNode.svelte';
import TextNode from '../../chat/components/TextNode.svelte';

export function getNodeComponent(nodeType: string) {
	switch (nodeType) {
		case 'condition':
			return ConditionNode;
		case 'damage':
			return DamageNode;
		case 'damageOutcome':
			return DamageOutcomeNode;
		case 'healing':
			return HealingNode;
		case 'note':
			return TextNode;
		case 'pool':
			return PoolNode;
		case 'savingThrow':
			return SavingThrowNode;
		default:
			return null;
	}
}
