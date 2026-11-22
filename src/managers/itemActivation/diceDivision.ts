import type { EffectNode } from '#types/effectTree.js';
import { rulesOfType } from '../../utils/actor/actorRules.js';
import { type DiceShare, evenDiceShares } from '../../utils/damage/evenDiceShares.js';
import { firstDiceOf } from '../../utils/damage/firstDiceOf.js';
import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';

/** The dice of an attack that the player divides among its targets, and what lets them. */
export interface DiceDivision {
	source: string;
	dice: number;
	targets: Array<{ uuid: string; name: string }>;
}

/**
 * The division a rule of the attacker offers for an attack with two or more targets, or null.
 * The dice are those of the first damage roll of the item.
 */
export function diceDivisionOf(
	actor: { rules?: unknown; getRollData?: () => Record<string, unknown> } | null | undefined,
	origin: string,
	effects: EffectNode[] | undefined,
	targets: DiceDivision['targets'],
): DiceDivision | null {
	if (targets.length < 2) return null;
	const source = rulesOfType(actor, 'divideDice')
		.map((rule) => rule.dividesDiceFor(origin))
		.find((offer) => offer !== null)?.source;
	if (source === undefined) return null;
	const attack = flattenEffectsTree(effects ?? []).find(
		(node) => node.type === 'damage' && !node.deferredRoll,
	) as { formula?: string } | undefined;
	const dice = firstDiceOf(attack?.formula ?? '', actor?.getRollData?.() ?? {})?.count ?? 0;
	if (dice < 1) return null;
	return {
		source,
		dice,
		targets,
	};
}

/** The shares the player chose, when they give out every die to the targets; else an even spread. */
export function diceSharesOf(
	division: DiceDivision,
	chosen: readonly DiceShare[] | undefined,
): DiceShare[] {
	const uuids = division.targets.map((target) => target.uuid);
	const fits =
		!!chosen &&
		chosen.every((share) => uuids.includes(share.targetUuid) && share.dice >= 0) &&
		chosen.reduce((sum, share) => sum + share.dice, 0) === division.dice;
	const shares = fits ? chosen : evenDiceShares(division.dice, uuids);
	return shares.filter((share) => share.dice > 0);
}
