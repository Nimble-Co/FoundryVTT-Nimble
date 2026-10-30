/** A marker effect on a marked creature: the effect that shows the mark. */
export interface MarkerEffect {
	parent?: { uuid?: string } | null;
	getFlag(scope: string, key: string): unknown;
}

/** A creature that can carry marker effects. */
export interface MarkedActor {
	effects: Iterable<MarkerEffect & { id: string; statuses?: Set<string> }>;
}
