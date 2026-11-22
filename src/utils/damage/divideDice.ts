import type { EffectNode } from '#types/effectTree.js';
import type { DiceShare } from './evenDiceShares.js';
import { firstDiceOf } from './firstDiceOf.js';

interface DividedNode {
	id: string;
	type: string;
	formula?: string;
	damageType?: string;
	/** The token that alone takes this damage. */
	forTarget?: string;
	/** The dice of the attack roll that another target takes: a crit of the attack is a crit of them. */
	sharesAttackRoll?: boolean;
	/** Damage for all the dice of the attack: each target takes its part of it. */
	dividesWithDice?: boolean;
	canCrit?: boolean;
	canMiss?: boolean;
	parentNode: string | null;
	parentContext: string | null;
	on?: Record<string, DividedNode[]>;
}

function withDiceCount(formula: string, count: number): string {
	const dice = firstDiceOf(formula, {});
	if (!dice) return formula;
	return `${formula.slice(0, dice.countStart)}${count}${formula.slice(dice.dieIndex)}`;
}

function partOf(formula: string, dice: number, of: number): string {
	return `floor((${formula}) * ${dice} / ${of})`;
}

/** Every damage of the tree is the first target's, until a copy says otherwise. */
function forFirstTarget(nodes: DividedNode[], targetUuid: string): void {
	for (const node of nodes) {
		if (node.type === 'damage') node.forTarget = targetUuid;
		forFirstTarget(Object.values(node.on ?? {}).flat(), targetUuid);
	}
}

/** A copy of a node and its children for another target, with new ids. */
function copyFor(
	node: DividedNode,
	suffix: string,
	targetUuid: string,
	formula: string,
): DividedNode {
	const id = `${node.id}${suffix}`;
	const on = Object.fromEntries(
		Object.entries(node.on ?? {}).map(([context, children]) => [
			context,
			children.map((child) => ({
				...structuredClone(child),
				id: `${child.id}${suffix}`,
				parentNode: id,
			})),
		]),
	);
	return { ...structuredClone(node), id, formula, forTarget: targetUuid, on };
}

/**
 * Divide the dice of an attack's first damage roll among targets, before the roll. The first
 * target with dice takes its dice of the roll and every flat damage; each other target takes
 * its dice as its own damage. Damage marked to divide with the dice is divided the same way.
 */
export function divideDice(
	effects: EffectNode[],
	shares: readonly DiceShare[],
	rollFormula?: string,
): { effects: EffectNode[]; rollFormula?: string } {
	const given = shares.filter((share) => share.dice > 0);
	const nodes = structuredClone(effects) as unknown as DividedNode[];
	const attack = nodes.find((node) => node.type === 'damage');
	const first = given[0];
	if (!attack?.formula || !first) return { effects, rollFormula };
	const dice = firstDiceOf(attack.formula, {});
	const total = given.reduce((sum, share) => sum + share.dice, 0);
	if (!dice) return { effects, rollFormula };

	forFirstTarget(nodes, first.targetUuid);
	const divided = nodes.filter((node) => node.type === 'damage' && node.dividesWithDice);
	const others = given.slice(1);
	const result: DividedNode[] = [];
	for (const node of nodes) {
		if (node === attack) {
			result.push({ ...node, formula: withDiceCount(node.formula ?? '', first.dice) });
			others.forEach((share, index) => {
				result.push({
					...copyFor(node, `-share${index + 1}`, share.targetUuid, `${share.dice}d${dice.faces}`),
					canCrit: false,
					canMiss: false,
					sharesAttackRoll: true,
				});
			});
			continue;
		}
		if (!divided.includes(node)) {
			result.push(node);
			continue;
		}
		result.push({ ...node, formula: partOf(node.formula ?? '0', first.dice, total) });
		others.forEach((share, index) => {
			result.push(
				copyFor(
					node,
					`-share${index + 1}`,
					share.targetUuid,
					partOf(node.formula ?? '0', share.dice, total),
				),
			);
		});
	}

	return {
		effects: result as unknown as EffectNode[],
		rollFormula: rollFormula === undefined ? undefined : withDiceCount(rollFormula, first.dice),
	};
}
