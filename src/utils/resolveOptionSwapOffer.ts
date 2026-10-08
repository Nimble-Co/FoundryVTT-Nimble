import type { OptionSwapRule } from '../models/rules/optionSwap.js';
import type { SkillPointMoveRule } from '../models/rules/skillPointMove.js';
import { stripHtml } from './stripHtml.js';

/** The feature that offers a change: what its text says about when, and what it covers. */
export interface OptionSwapSource {
	name: string;
	/** The feature's own description, or the rule's label when it has none. */
	text: string;
	/** The owned item's uuid, or empty when the rule has no item. */
	uuid: string;
	img: string;
	/** Whether the feature's swap rule covers every pool the class offers. */
	coversAllGroups: boolean;
	/** The groups its swap rule names, when it does not cover everything. */
	groups: string[];
	/** Skill points its move rule offers, 0 when it has none. */
	skillPoints: number;
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
			const source = sourceFor(sources, rule);
			if (source) {
				if (rule.coversAllGroups) source.coversAllGroups = true;
				for (const group of rule.namedGroups) {
					if (!source.groups.includes(group)) source.groups.push(group);
				}
			}
			continue;
		}

		if (rule?.type === 'skillPointMove' && rule.offersMoveOn?.(trigger)) {
			skillPoints += rule.points;
			const source = sourceFor(sources, rule);
			if (source) source.skillPoints += rule.points;
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

/** The record for the rule's feature, made once however many rules on it make an offer. */
function sourceFor(
	sources: OptionSwapSource[],
	rule: { label?: string; item?: unknown },
): OptionSwapSource | null {
	const item = rule.item as
		| { uuid?: string; name?: string; img?: string; system?: { description?: string } }
		| undefined;
	const name = item?.name ?? '';
	const text = stripHtml(item?.system?.description ?? '').trim() || rule.label || '';
	if (!name && !text) return null;

	const uuid = item?.uuid ?? '';
	const existing = sources.find((source) =>
		uuid ? source.uuid === uuid : source.name === name && source.text === text,
	);
	if (existing) return existing;

	const source: OptionSwapSource = {
		name,
		text,
		uuid,
		img: item?.img ?? '',
		coversAllGroups: false,
		groups: [],
		skillPoints: 0,
	};
	sources.push(source);
	return source;
}
