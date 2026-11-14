import { checkFormulaReferences } from './formulaReferences.js';

/** Unless otherwise noted, the DC for effects a hero causes. */
const HERO_SAVE_DC_FORMULA = '10+@key';

interface ItemUser {
	type: string;
	name?: string | null;
	isOwner?: boolean;
	getRollData(): Record<string, unknown>;
}

function hasKeyStat(rollData: Record<string, unknown>): boolean {
	return typeof rollData.key === 'number' && Number.isFinite(rollData.key);
}

/**
 * The DC of a save node for the creature that used the item, or null. An empty
 * field gives a hero with a key stat the hero DC, and anything else no DC.
 */
function resolveSaveNodeDC(saveDC: number | string | null | undefined, itemUser: ItemUser | null) {
	const rollData = itemUser?.getRollData() ?? {};
	const written = saveDC ? String(saveDC).trim() : '';
	if (!written && (itemUser?.type !== 'character' || !hasKeyStat(rollData))) return null;

	const formula = written || HERO_SAVE_DC_FORMULA;
	checkFormulaReferences(formula, itemUser, {}, { rollData });
	try {
		const value = Roll.safeEval(Roll.replaceFormulaData(formula, rollData));
		return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;
	} catch (error) {
		console.warn(`Nimble | Could not work out the save DC formula "${formula}".`, error);
		return null;
	}
}

/** A save node's DC field with `amount` added. An empty field starts from the hero DC. */
function addToSaveDC(saveDC: number | string | null | undefined, amount: number): number | string {
	const written = String(saveDC ?? '').trim();
	if (!written) return `${HERO_SAVE_DC_FORMULA}+${amount}`;

	const number = Number(written);
	return Number.isNaN(number) ? `${written}+${amount}` : number + amount;
}

interface EffectTreeNode {
	type?: string;
	saveDC?: number | string | null;
	on?: Record<string, unknown> | null;
	sharedRolls?: unknown;
}

function childNodes(node: EffectTreeNode): unknown[] {
	const children: unknown[] = [];
	for (const value of Object.values(node.on ?? {})) {
		if (Array.isArray(value)) children.push(...value);
		else if (value && typeof value === 'object') {
			for (const nested of Object.values(value))
				if (Array.isArray(nested)) children.push(...nested);
		}
	}
	if (Array.isArray(node.sharedRolls)) children.push(...node.sharedRolls);
	return children;
}

/**
 * Write the number into each save node of an activation tree whose DC the user
 * can work out, so the card keeps the DC of the use. Other DCs stay as written.
 */
function fixSaveDCs(
	effects: readonly unknown[] | null | undefined,
	itemUser: ItemUser | null,
): void {
	for (const entry of effects ?? []) {
		if (!entry || typeof entry !== 'object') continue;
		const node = entry as EffectTreeNode;
		if (node.type === 'savingThrow') {
			const dc = resolveSaveNodeDC(node.saveDC, itemUser);
			if (dc !== null) node.saveDC = dc;
		}
		fixSaveDCs(childNodes(node), itemUser);
	}
}

export { addToSaveDC, fixSaveDCs, resolveSaveNodeDC };
