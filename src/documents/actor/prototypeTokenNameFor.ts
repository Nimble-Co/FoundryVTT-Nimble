/**
 * Core copies the actor name to the prototype token only on create. Returns the
 * token name a rename must carry, or undefined when the token name was set by
 * hand or the update sets it itself.
 */
export function prototypeTokenNameFor(
	changes: Record<string, unknown>,
	actorName: string,
	tokenName: string,
): string | undefined {
	const newName = changes.name;
	if (typeof newName !== 'string' || newName === actorName) return undefined;
	if (tokenName && tokenName !== actorName) return undefined;

	const tokenChanges = changes.prototypeToken as { name?: unknown } | undefined;
	if (tokenChanges?.name !== undefined || changes['prototypeToken.name'] !== undefined) {
		return undefined;
	}

	return newName;
}
