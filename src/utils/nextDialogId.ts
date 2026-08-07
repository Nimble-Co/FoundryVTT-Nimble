let counter = 0;

/**
 * A process-unique integer for scoping DOM names inside a dialog instance.
 *
 * Radio groups are keyed by `name`, which is global to the document: two copies
 * of the same dialog open at once would otherwise share one group and steal each
 * other's selection.
 */
export default function nextDialogId(): number {
	counter += 1;
	return counter;
}
