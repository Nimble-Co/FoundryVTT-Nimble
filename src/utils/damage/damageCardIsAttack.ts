import { isAttackRoll } from '../heldChange/heldChange.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';

interface ActivationCard {
	system?: { activation?: { targets?: { attackType?: string }; effects?: unknown[] } };
}

/** An attack card can hit, crit, or miss. Setting HP to 0, and other damage, are not attacks. */
export function damageCardIsAttack(cardId: string | null): boolean {
	if (!cardId) return false;
	try {
		const messages = (game as { messages?: { get?: (id: string) => unknown } }).messages;
		const activation = (messages?.get?.(cardId) as ActivationCard | null | undefined)?.system
			?.activation;
		if (!activation) return false;
		const damage = flattenEffectsTree((activation.effects ?? []) as never[]).find(
			(node) => node.type === 'damage',
		);
		return isAttackRoll(activation.targets?.attackType, damage);
	} catch {
		return false;
	}
}
