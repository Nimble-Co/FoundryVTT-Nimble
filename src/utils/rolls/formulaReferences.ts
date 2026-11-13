import type {
	FormulaActor,
	FormulaCheckOptions,
	FormulaOwner,
	FormulaRule,
} from '#types/formulaReferences.d.ts';
import localize from '#utils/localize.js';

const FORMULA_REFERENCE = /@{[-.\w]+}|@[-.\w]+/g;

// Session-lifetime: one entry per distinct misconfigured formula reference.
const warned = new Set<string>();

/** The owner of a formula that a rule holds. */
function ruleOwner(rule: FormulaRule): FormulaOwner {
	return { item: rule.parentDocument, rule: rule.label || rule.type || '' };
}

/** The owner of a formula that a pool holds, read from the item that grants the pool. */
function poolOwner(
	actor: { items?: { get?: (id: string) => unknown } } | null | undefined,
	pool: { sourceItemId?: string; label?: string },
): FormulaOwner {
	const item = actor?.items?.get?.(pool.sourceItemId ?? '') as FormulaOwner['item'];
	return { item, rule: pool.label ?? '' };
}

/** The `@` references of a formula that the roll data has no value for. */
function findMissingReferences(formula: string, rollData: object): string[] {
	const references = formula.match(FORMULA_REFERENCE) ?? [];
	return references.filter(
		(reference) => foundry.utils.getProperty(rollData, reference.replace(/^@{?|}?$/g, '')) == null,
	);
}

function warningKey(actor: FormulaActor, owner: FormulaOwner, reference: string): string {
	return `${owner.item?.name ?? ''}:${actor.name ?? ''}:${owner.rule ?? ''}:${reference}`;
}

/**
 * Foundry reads an unknown `@` reference as 0 with no message. Tell the item
 * owner once, after data preparation ends, so values set late are not reported.
 */
function checkFormulaReferences(
	formula: unknown,
	actor: FormulaActor | null | undefined,
	owner: FormulaOwner,
	options: FormulaCheckOptions = {},
): void {
	if (!actor || typeof formula !== 'string' || !formula.includes('@')) return;
	const extra = options.extraRollData ?? {};
	const rollData = { ...(options.rollData ?? actor.getRollData?.() ?? {}), ...extra };
	const unwarned = findMissingReferences(formula, rollData).filter(
		(reference) => !warned.has(warningKey(actor, owner, reference)),
	);
	if (!unwarned.length) return;
	queueMicrotask(() =>
		warnMissingReferences(formula, actor, owner, { ...(actor.getRollData?.() ?? {}), ...extra }),
	);
}

function messageKey(owner: FormulaOwner): string {
	if (!owner.item?.name) return 'NIMBLE.formulaWarnings.actorOnly';
	if (owner.rule) return 'NIMBLE.formulaWarnings.rule';
	return 'NIMBLE.formulaWarnings.item';
}

function warnMissingReferences(
	formula: string,
	actor: FormulaActor,
	owner: FormulaOwner,
	rollData: object,
): void {
	// Keyed on names, so the copies on unlinked tokens warn once.
	const missing = findMissingReferences(formula, rollData).filter((reference) => {
		const key = warningKey(actor, owner, reference);
		if (warned.has(key)) return false;
		warned.add(key);
		return true;
	});
	if (!missing.length) return;

	const message = localize(messageKey(owner), {
		item: owner.item?.name ?? '',
		actor: actor.name ?? '',
		rule: owner.rule ?? '',
		references: missing.join(', '),
	});
	// eslint-disable-next-line no-console
	console.warn(`Nimble | ${message}`);
	const tellsOwner = owner.item ? owner.item.isOwner : actor.isOwner;
	if (tellsOwner) ui.notifications?.warn(message);
}

export { checkFormulaReferences, findMissingReferences, poolOwner, ruleOwner };
