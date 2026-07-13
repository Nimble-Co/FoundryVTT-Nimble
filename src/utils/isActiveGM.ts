/**
 * Whether this client is the single designated active GM. Use it to gate work
 * that must run exactly once across all connected clients. Falls back to any
 * connected GM when Foundry has not designated one.
 */
export function isActiveGM(): boolean {
	const users = game.users as unknown as { activeGM?: { id?: string | null } | null };
	const activeGmId = users?.activeGM?.id ?? null;
	if (activeGmId) return activeGmId === game.user?.id;
	return Boolean(game.user?.isGM);
}
