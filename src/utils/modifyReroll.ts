import type { RerollRollKind } from './rollToReroll.js';

/** A `modifyReroll` rule as the reroll code reads it. */
interface ModifyRerollRuleLike {
	id?: string;
	type: string;
	disabled?: boolean;
	rerollIdentifier?: string;
	rollModeChange?: number;
	extraDamage?: string;
	appliesTo?: () => boolean;
	item?: { name?: string; uuid?: string } | null;
}

interface ModifierOwner {
	getRollData?: () => Record<string, unknown>;
	items?: { contents: Array<{ rules?: Map<string, unknown> }> };
}

/** A roll change one Modify Reroll rule adds to a reroll. `key` makes it count once per card. */
type ModifyRerollChange =
	| { key: string; kind: 'rollMode'; label: string; value: number }
	| { key: string; kind: 'extraDamage'; label: string; formula: string };

/** The owner's enabled `modifyReroll` rules that name the reroll rule's identifier. */
function modifyRerollRules(reroll: {
	identifier?: string;
	actor?: ModifierOwner | null;
}): ModifyRerollRuleLike[] {
	const identifier = reroll.identifier?.trim() ?? '';
	if (!identifier) return [];
	const found: ModifyRerollRuleLike[] = [];
	for (const item of reroll.actor?.items?.contents ?? []) {
		for (const rule of item.rules?.values() ?? []) {
			const modifier = rule as ModifyRerollRuleLike;
			if (modifier.type !== 'modifyReroll' || modifier.disabled) continue;
			if (modifier.rerollIdentifier?.trim() !== identifier) continue;
			if (modifier.appliesTo && !modifier.appliesTo()) continue;
			found.push(modifier);
		}
	}
	return found;
}

/**
 * The roll changes the reroll owner's Modify Reroll rules add to this reroll.
 * Changes in `applied` are left out. Extra damage is for an attack only.
 */
function modifyRerollChanges(
	reroll: { identifier?: string; actor?: ModifierOwner | null },
	kind: RerollRollKind,
	applied: readonly string[] = [],
): ModifyRerollChange[] {
	const changes: ModifyRerollChange[] = [];
	for (const modifier of modifyRerollRules(reroll)) {
		const label = modifier.item?.name ?? '';
		const base = `${modifier.item?.uuid ?? ''}#${modifier.id ?? ''}`;
		const value = Math.sign(Number(modifier.rollModeChange) || 0);
		if (value !== 0) changes.push({ key: `${base}:rollMode`, kind: 'rollMode', label, value });
		const formula = kind === 'attack' ? (modifier.extraDamage ?? '').trim() : '';
		if (formula) {
			changes.push({
				key: `${base}:extraDamage`,
				kind: 'extraDamage',
				label,
				formula: Roll.replaceFormulaData(formula, reroll.actor?.getRollData?.() ?? {}, {
					missing: '0',
				}),
			});
		}
	}
	return changes.filter((change) => !applied.includes(change.key));
}

export {
	type ModifyRerollChange,
	type ModifyRerollRuleLike,
	modifyRerollChanges,
	modifyRerollRules,
};
