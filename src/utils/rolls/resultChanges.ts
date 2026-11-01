import type { ResultChange, ResultUse } from '#types/resultChange.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import type { IncomingReactionEntry } from '../incomingReactions/incomingReactionEntry.js';
import type { RollToReroll } from '../reroll/rollToReroll.js';

const NATURAL_20 = 20;
/** A total at or under this can count as a natural 20. */
const LOW_RESULT = 1;

interface NaturalRuleLike {
	id?: string;
	label?: string;
	item?: { name?: string; uuid?: string } | null;
	countsAsNat20On?: (roll: RollToReroll) => boolean;
}

/** The Change a Result clicks on a card. A card posted before them has none. */
function resultChangesOf(system: unknown): ResultChange[] {
	const changes = (system as { resultChanges?: unknown } | null | undefined)?.resultChanges;
	return Array.isArray(changes) ? (changes as ResultChange[]) : [];
}

/** The clicks that still count: no new roll has taken them off. */
function standingResultChanges(changes: readonly ResultChange[]): ResultChange[] {
	return changes.filter((change) => !change.retired);
}

function totalAfterChange(total: number, change: ResultChange): number {
	if (change.change === 'add') return total + change.value;
	if (change.change === 'setTotal' || change.change === 'countsAsNat20') return change.value;
	return total;
}

/** The total a card shows: the roll's total with the standing clicks on it, in order. */
function resultTotal(rollTotal: number, changes: readonly ResultChange[]): number {
	return standingResultChanges(changes).reduce(totalAfterChange, rollTotal);
}

/** The clicks after a new roll: each standing one is retired, and keeps the total it replaced. */
function retireResultChanges(rollTotal: number, changes: readonly ResultChange[]): ResultChange[] {
	let total = rollTotal;
	return changes.map((change) => {
		if (change.retired) return change;
		const before = total;
		total = totalAfterChange(total, change);
		return { ...change, retired: true, before };
	});
}

/** The record of one click. A repeat of an add that stands joins that add's history line. */
function newResultChange(input: {
	entry: Pick<IncomingReactionEntry, 'id' | 'itemUuid' | 'ruleId' | 'label' | 'actorUuid'> &
		Partial<Pick<IncomingReactionEntry, 'targetTokenUuid'>>;
	use: ResultUse;
	changes: readonly ResultChange[];
	chargePoolIdentifier: string;
	paid: ResultChange['paid'];
}): ResultChange {
	const { entry, use, changes } = input;
	const id = foundry.utils.randomID();
	const line =
		use.change === 'add'
			? standingResultChanges(changes).find(
					(change) =>
						change.change === 'add' &&
						change.ruleId === entry.ruleId &&
						change.itemUuid === entry.itemUuid &&
						change.actorUuid === entry.actorUuid,
				)
			: undefined;
	return {
		id,
		lineId: line?.lineId ?? id,
		entryId: entry.id,
		itemUuid: entry.itemUuid,
		ruleId: entry.ruleId,
		label: entry.label,
		actorUuid: entry.actorUuid,
		...use,
		retired: false,
		before: null,
		chargePoolIdentifier: input.chargePoolIdentifier,
		paid: input.paid,
		...(use.change === 'noDamage' ? { targetTokenUuid: input.entry.targetTokenUuid ?? null } : {}),
	};
}

/** The change a rule makes with no click: a low result counts as a natural 20. */
function naturalResultChange(input: {
	roller: { uuid?: string; rules?: unknown } | null | undefined;
	roll: RollToReroll;
	rollTotal: number;
	keptD20: number | null;
}): ResultChange | null {
	const { rollTotal, keptD20 } = input;
	if (keptD20 === null || rollTotal > LOW_RESULT || !isRuleAutomationEnabled()) return null;
	const rules = Array.isArray(input.roller?.rules) ? input.roller.rules : [];
	const rule = (rules as NaturalRuleLike[]).find((each) => each?.countsAsNat20On?.(input.roll));
	if (!rule) return null;
	const id = foundry.utils.randomID();
	return {
		id,
		lineId: id,
		entryId: '',
		itemUuid: rule.item?.uuid ?? '',
		ruleId: rule.id ?? '',
		label: rule.label || rule.item?.name || '',
		actorUuid: input.roller?.uuid ?? '',
		change: 'countsAsNat20',
		value: NATURAL_20 + rollTotal - keptD20,
		stat: '',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 0 },
		automatic: true,
	};
}

export {
	LOW_RESULT,
	NATURAL_20,
	naturalResultChange,
	newResultChange,
	resultChangesOf,
	resultTotal,
	retireResultChanges,
	standingResultChanges,
};
