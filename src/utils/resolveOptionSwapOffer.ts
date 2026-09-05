import type { OptionSwapRule } from '../models/rules/optionSwap.js';
import type { SkillPointMoveRule } from '../models/rules/skillPointMove.js';
import { stripHtml } from './stripHtml.js';

/** The feature that offers a change, and what its text says about when. For display only. */
export interface OptionSwapSource {
	name: string;
	/** The feature's own description, or the rule's label when it has none. */
	text: string;
}

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
	 * The features whose rules make the offer, so the surface can quote them. Nothing in
	 * their text is checked; the table decides whether it happened.
	 */
	sources: OptionSwapSource[];
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
	const sources: OptionSwapSource[] = [];
	let coversAllGroups = false;
	let offersSwap = false;
	let skillPoints = 0;

	for (const candidate of rules) {
		const rule = candidate as OptionSwapRule & SkillPointMoveRule & { type?: string };

		if (rule?.type === 'optionSwap' && rule.offersSwapOn?.(trigger)) {
			offersSwap = true;
			if (rule.coversAllGroups) coversAllGroups = true;
			for (const group of rule.namedGroups) namedGroups.add(group);
			addSource(sources, rule);
			continue;
		}

		if (rule?.type === 'skillPointMove' && rule.offersMoveOn?.(trigger)) {
			skillPoints += rule.points;
			addSource(sources, rule);
		}
	}

	if (!offersSwap && skillPoints < 1) return null;

	return {
		// A rule covering everything makes any narrower sibling redundant rather than
		// contradictory, so the widest offer wins.
		allowedGroups: !offersSwap ? new Set() : coversAllGroups ? null : namedGroups,
		skillPoints,
		sources,
	};
}

/** Records the rule's feature once, however many rules on it make an offer. */
function addSource(sources: OptionSwapSource[], rule: { label?: string; item?: unknown }) {
	const item = rule.item as { name?: string; system?: { description?: string } } | undefined;
	const name = item?.name ?? '';
	const text = stripHtml(item?.system?.description ?? '').trim() || rule.label || '';
	if (!name && !text) return;
	if (sources.some((source) => source.name === name && source.text === text)) return;
	sources.push({ name, text });
}
