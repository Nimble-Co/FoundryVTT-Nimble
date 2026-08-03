/**
 * The user id of the single GM client designated to execute relayed socket
 * requests, or `null` when no GM is connected. Prefers Foundry's designated
 * active GM and falls back to any connected GM, so emitters and listeners
 * agree on one executor.
 */
export function getPrimaryActiveGmId(): string | null {
	const usersCollection = game.users as unknown as {
		activeGM?: { id?: string | null } | null;
		contents?: Array<{ active?: boolean; id?: string | null; isGM?: boolean }>;
	};
	const activeGmId = usersCollection.activeGM?.id ?? null;
	if (activeGmId) return activeGmId;
	return (
		usersCollection.contents?.find((user) => user.isGM === true && user.active === true)?.id ?? null
	);
}
