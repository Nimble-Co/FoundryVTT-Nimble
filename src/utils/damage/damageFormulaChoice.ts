import { ruleKey, ruleLabel, rulesOfType } from '../actor/actorRules.js';

/** A tick that replaces one dice term of the attack's damage. */
export interface DamageFormulaChoiceOffer {
	key: string;
	label: string;
	from: string;
	to: string;
}

interface ChoiceRule {
	disabled?: boolean;
	isOnActor?: boolean;
	itemIdentifier?: string;
	from?: string;
	to?: string;
	label?: string;
	id?: string | null;
	parentDocument?: { name?: string | null; uuid?: string | null; identifier?: string } | null;
	appliesTo?: () => boolean;
	test?: () => boolean;
}

/**
 * The formula with the first whole `from` term replaced by `to`.
 * Null when `from` is not a whole term, so `1d8` does not match `11d8` or `1d80`.
 */
export function replaceDiceTerm(formula: string, from: string, to: string): string | null {
	const needle = from.trim();
	const replacement = to.trim();
	if (!needle || !replacement) return null;
	const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`);
	if (!pattern.test(formula)) return null;
	return formula.replace(pattern, replacement);
}

function wantedIdentifier(rule: ChoiceRule): string {
	const authored = rule.itemIdentifier?.trim() ?? '';
	return authored || (rule.parentDocument?.identifier ?? '');
}

function rulePasses(rule: ChoiceRule): boolean {
	if (rule.disabled === true || rule.isOnActor === false) return false;
	if (typeof rule.appliesTo === 'function') return rule.appliesTo();
	if (typeof rule.test === 'function') return rule.test();
	return true;
}

/** The damage-formula ticks for an attack that uses `itemIdentifier` and rolls `formula`. */
export function damageFormulaChoiceOffers(
	actor: unknown,
	itemIdentifier: string,
	formula: string,
): DamageFormulaChoiceOffer[] {
	if (!itemIdentifier) return [];
	const holder = actor as { rules?: unknown } | null | undefined;
	return rulesOfType(holder, 'damageFormulaChoice').flatMap((rule) => {
		const choice = rule as unknown as ChoiceRule;
		if (!rulePasses(choice) || wantedIdentifier(choice) !== itemIdentifier) return [];
		const from = choice.from ?? '';
		const to = choice.to ?? '';
		if (replaceDiceTerm(formula, from, to) === null) return [];
		return [{ key: ruleKey(choice), label: ruleLabel(choice), from: from.trim(), to: to.trim() }];
	});
}

/**
 * `formula` with each checked tick applied, in offer order.
 * Null when no checked tick changes the formula.
 */
export function applyDamageFormulaChoices(
	formula: string,
	offers: readonly DamageFormulaChoiceOffer[],
	checked: Readonly<Record<string, boolean>>,
): string | null {
	let next = formula;
	let changed = false;
	for (const offer of offers) {
		if (checked[offer.key] !== true) continue;
		const replaced = replaceDiceTerm(next, offer.from, offer.to);
		if (replaced === null) continue;
		next = replaced;
		changed = true;
	}
	return changed ? next : null;
}
