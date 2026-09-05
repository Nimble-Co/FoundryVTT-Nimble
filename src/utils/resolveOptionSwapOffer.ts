import { ALL_GROUPS, type OptionSwapRule } from '../models/rules/optionSwap.js';
import type { SkillPointMoveRule } from '../models/rules/skillPointMove.js';

/** The groups a character's `optionSwap` rules cover, and the acts those rules ask for. */
export interface OptionSwapOffer {
	/**
	 * Groups the swap covers, or `null` for every pool the class offers — the sentinel `all`,
	 * which is what the class features mean by "different <Class> options available to you".
	 */
	allowedGroups: Set<string> | null;
	/** How many skill points may be moved. */
	skillPoints: number;
	/**
	 * What each offering rule asks the character to do in the fiction, for display only.
	 * None of it is checked; the table decides whether it happened.
	 */
	requiredActs: string[];
}

interface RuleBearingActor {
	rules?: unknown[];
}

/**
 * Reads what a character may change on a given rest.
 *
 * Returns `null` when nothing is offered, so a caller can skip the whole surface rather than
 * render an empty one. A character with no offering feature is the common case.
 */
export default function resolveOptionSwapOffer(
	actor: RuleBearingActor | null | undefined,
	trigger: string,
): OptionSwapOffer | null {
	const rules = actor?.rules ?? [];

	const namedGroups = new Set<string>();
	const requiredActs: string[] = [];
	let coversAllGroups = false;
	let offersSwap = false;
	let skillPoints = 0;

	for (const candidate of rules) {
		const rule = candidate as OptionSwapRule & SkillPointMoveRule & { type?: string };

		if (rule?.type === 'optionSwap' && rule.offersSwapOn?.(trigger)) {
			offersSwap = true;
			if (rule.coversAllGroups) coversAllGroups = true;
			for (const group of rule.namedGroups) namedGroups.add(group);
			if (rule.label) requiredActs.push(rule.label);
			continue;
		}

		if (rule?.type === 'skillPointMove' && rule.offersMoveOn?.(trigger)) {
			skillPoints += rule.points;
			if (rule.label) requiredActs.push(rule.label);
		}
	}

	if (!offersSwap && skillPoints < 1) return null;

	return {
		// A rule covering everything makes any narrower sibling redundant rather than
		// contradictory, so the widest offer wins.
		allowedGroups: !offersSwap ? new Set() : coversAllGroups ? null : namedGroups,
		skillPoints,
		requiredActs,
	};
}

export { ALL_GROUPS };
