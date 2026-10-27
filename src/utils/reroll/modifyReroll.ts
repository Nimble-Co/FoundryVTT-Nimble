import type { RollChange } from '../incomingReactions/incomingReactionEntry.js';
import type { GrantModifier } from './rerollGrants.js';
import type { RerollRollKind } from './rollToReroll.js';

/** A `modifyReroll` rule as the reroll code reads it. */
interface ModifyRerollRuleLike {
	id?: string;
	type: string;
	disabled?: boolean;
	rerollIdentifier?: string;
	rollModeChange?: number;
	extraDamage?: string;
	actionsForRoller?: number;
	tempHp?: string;
	tempHpWithin?: number;
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

/** The whole-number result of a formula that has no `@` values left; dice are rolled. */
async function rollTotal(formula: string): Promise<number> {
	let value = Number(formula);
	if (!Number.isFinite(value)) {
		const roll = new Roll(formula);
		await roll.evaluate();
		value = Number(roll.total) || 0;
	}
	return Math.trunc(value);
}

/** A formula of a Modify Reroll rule worked out with its owner's values. */
async function evaluateOwnerFormula(formula: string, owner: ModifierOwner | null | undefined) {
	const text = formula.trim();
	if (!text) return 0;
	return rollTotal(Roll.replaceFormulaData(text, owner?.getRollData?.() ?? {}, { missing: '0' }));
}

/** What the owner's Modify Reroll rules give creatures on each use of the reroll. */
async function grantModifiers(reroll: {
	identifier?: string;
	actor?: ModifierOwner | null;
}): Promise<GrantModifier[]> {
	const modifiers: GrantModifier[] = [];
	for (const modifier of modifyRerollRules(reroll)) {
		const actions = Math.max(0, Math.trunc(Number(modifier.actionsForRoller) || 0));
		const tempHp = Math.max(0, await evaluateOwnerFormula(modifier.tempHp ?? '', reroll.actor));
		if (actions < 1 && tempHp < 1) continue;
		modifiers.push({
			label: modifier.item?.name ?? '',
			actions,
			tempHp,
			tempHpWithin: Math.max(0, Number(modifier.tempHpWithin) || 0),
		});
	}
	return modifiers;
}

/** The changes with their extra damage rolled, as the card stores them. */
async function resolveRollChanges(changes: readonly ModifyRerollChange[]): Promise<RollChange[]> {
	const resolved: RollChange[] = [];
	for (const change of changes) {
		if (change.kind === 'rollMode') {
			resolved.push(change);
			continue;
		}
		resolved.push({
			key: change.key,
			kind: change.kind,
			label: change.label,
			value: await rollTotal(change.formula),
		});
	}
	return resolved;
}

/** The resolved changes the reroll owner's Modify Reroll rules add, without those in `applied`. */
async function newRollChanges(
	reroll: { identifier?: string; actor?: unknown },
	kind: RerollRollKind,
	applied: readonly RollChange[],
): Promise<RollChange[]> {
	const owner = { identifier: reroll.identifier, actor: reroll.actor as ModifierOwner | null };
	return resolveRollChanges(
		modifyRerollChanges(
			owner,
			kind,
			applied.map((change) => change.key),
		),
	);
}

export {
	type ModifyRerollChange,
	type ModifyRerollRuleLike,
	grantModifiers,
	type ModifierOwner,
	modifyRerollChanges,
	modifyRerollRules,
	newRollChanges,
	resolveRollChanges,
};
