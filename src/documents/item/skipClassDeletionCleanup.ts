/** Level-down sets this so deleting the new class does not clean the actor a second time. */
const SKIP_CLASS_CLEANUP = Symbol('skipClassCleanup');

export function skipClassDeletionCleanup(item: object): void {
	(item as { [SKIP_CLASS_CLEANUP]?: true })[SKIP_CLASS_CLEANUP] = true;
}

export function shouldSkipClassCleanup(item: object): boolean {
	return (item as { [SKIP_CLASS_CLEANUP]?: true })[SKIP_CLASS_CLEANUP] === true;
}
