import type {
	IncomingReactionEntry,
	ResultChange,
	ResultUse,
} from '../incomingReactions/incomingReactionEntry.js';

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
	return change.change === 'setTotal' ? change.value : total;
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
	entry: Pick<IncomingReactionEntry, 'id' | 'itemUuid' | 'ruleId' | 'label' | 'actorUuid'>;
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
	};
}

export {
	newResultChange,
	resultChangesOf,
	resultTotal,
	retireResultChanges,
	standingResultChanges,
};
