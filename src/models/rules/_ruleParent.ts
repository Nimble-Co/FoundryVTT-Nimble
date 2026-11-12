export type EffectParent = ActiveEffect & {
	documentName: 'ActiveEffect';
	target: foundry.abstract.Document.Any | null;
};

/** Whether the document that holds rules is an Active Effect, not an item. */
export function isEffectParent<P extends { documentName?: string | null } | null | undefined>(
	parent: P,
): parent is P & EffectParent {
	return parent?.documentName === 'ActiveEffect';
}
