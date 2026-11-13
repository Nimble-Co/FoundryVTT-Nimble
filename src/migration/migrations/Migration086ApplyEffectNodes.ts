import {
	conditionsToItemEffects,
	type ItemEffectSource,
} from '#utils/treeManipulation/conditionsToItemEffects.js';
import { MigrationBase } from '../MigrationBase.js';

interface TreeNode {
	type?: string;
	condition?: string;
	on?: Record<string, unknown>;
	sharedRolls?: unknown[];
	[key: string]: unknown;
}

type NodeTest = (node: TreeNode) => boolean;

const isConditionNode: NodeTest = (node) => node?.type === 'condition';

/** On an item, an Apply Effect node that names only a condition also needs an effect. */
const needsItemEffect: NodeTest = (node) =>
	isConditionNode(node) || (node?.type === 'applyEffect' && !node.effectId && !!node.condition);

function hasNode(nodes: unknown, test: NodeTest): boolean {
	if (!Array.isArray(nodes)) return false;
	return nodes.some((value) => {
		const node = value as TreeNode;
		if (test(node)) return true;
		if (hasNode(node?.sharedRolls, test)) return true;
		return Object.values(node?.on ?? {}).some((branch) =>
			Array.isArray(branch)
				? hasNode(branch, test)
				: Object.values((branch ?? {}) as Record<string, unknown>).some((nested) =>
						hasNode(nested, test),
					),
		);
	});
}

/** A card has no item to hold an effect: its condition nodes become Apply Effect nodes that name the condition. */
function toCardShorthand(nodes: unknown): void {
	if (!Array.isArray(nodes)) return;
	for (const [index, value] of nodes.entries()) {
		const node = value as TreeNode;
		if (node?.type === 'condition') {
			nodes[index] = {
				id: node.id,
				type: 'applyEffect',
				effectId: null,
				condition: node.condition,
				recipient: 'targets',
				parentContext: node.parentContext ?? null,
				parentNode: node.parentNode ?? null,
			};
			continue;
		}
		toCardShorthand(node?.sharedRolls);
		for (const branch of Object.values(node?.on ?? {})) {
			if (Array.isArray(branch)) toCardShorthand(branch);
			else for (const nested of Object.values((branch ?? {}) as object)) toCardShorthand(nested);
		}
	}
}

function effectSource(effect: ItemEffectSource): Record<string, unknown> {
	return {
		...effect,
		description: '',
		disabled: false,
		origin: null,
		system: {
			changes: [],
			rules: [],
			lastsUntil: [],
			escape: { dc: '', saves: ['strength', 'dexterity'] },
			tempHp: null,
			minor: false,
		},
		flags: {},
	};
}

/**
 * The condition node goes. Each one in an item becomes an Apply Effect node with an effect on the
 * item that holds the condition (one effect for each condition), and goes to the targets. A card
 * in the chat log keeps the condition on the node, so its button still applies it.
 */
class Migration086ApplyEffectNodes extends MigrationBase {
	static override readonly version = 86;

	override readonly version = Migration086ApplyEffectNodes.version;

	override async updateItem(source: any): Promise<void> {
		const tree = source?.system?.activation?.effects;
		if (!hasNode(tree, needsItemEffect)) return;
		const created = conditionsToItemEffects(tree, () => foundry.utils.randomID());
		source.effects = [...(source.effects ?? []), ...created.map(effectSource)];
	}

	override async migrate(): Promise<void> {
		for (const message of game.messages ?? []) {
			const tree = (message.system as { activation?: { effects?: unknown[] } } | undefined)
				?.activation?.effects;
			if (!hasNode(tree, isConditionNode)) continue;
			const copy = foundry.utils.deepClone(tree) as unknown[];
			toCardShorthand(copy);
			try {
				await message.update(
					{ 'system.activation.effects': copy } as never,
					{ noHook: true } as never,
				);
			} catch (error) {
				console.warn(error);
			}
		}
	}
}

export { Migration086ApplyEffectNodes };
