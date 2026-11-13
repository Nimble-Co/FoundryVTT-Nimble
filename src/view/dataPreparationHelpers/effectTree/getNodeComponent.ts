import ApplyEffectNode from '../../chat/components/ApplyEffectNode.svelte';
import DamageNode from '../../chat/components/DamageNode.svelte';
import DamageOutcomeNode from '../../chat/components/DamageOutcomeNode.svelte';
import EndConditionsNode from '../../chat/components/EndConditionsNode.svelte';
import HealingNode from '../../chat/components/HealingNode.svelte';
import MoveNode from '../../chat/components/MoveNode.svelte';
import PoolNode from '../../chat/components/PoolNode.svelte';
import SavingThrowNode from '../../chat/components/SavingThrowNode.svelte';
import TextNode from '../../chat/components/TextNode.svelte';
import WoundNode from '../../chat/components/WoundNode.svelte';

export function getNodeComponent(nodeType: string) {
	switch (nodeType) {
		case 'applyEffect':
			return ApplyEffectNode;
		case 'damage':
			return DamageNode;
		case 'damageOutcome':
			return DamageOutcomeNode;
		case 'endConditions':
			return EndConditionsNode;
		case 'healing':
			return HealingNode;
		case 'move':
			return MoveNode;
		case 'note':
			return TextNode;
		case 'pool':
			return PoolNode;
		case 'savingThrow':
			return SavingThrowNode;
		case 'wound':
			return WoundNode;
		default:
			return null;
	}
}
