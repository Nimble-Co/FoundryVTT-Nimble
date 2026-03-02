type UserLike = {
	isGM?: boolean;
} | null;

type ReorderOptions = {
	user?: UserLike;
	ownerOverride?: boolean | null | undefined;
};

/**
 * Centralized combatant grouping priority.
 * Keep this in one place so future sequencing rules can add special priorities
 * (e.g., "ambusher acts first") without touching multiple files.
 */
export function getCombatantTypePriority(combatant: Combatant.Implementation): number {
	return combatant.type === 'character' ? 0 : 1;
}

export function canCurrentUserReorderCombatant(
	combatant: Combatant.Implementation,
	options: ReorderOptions = {},
): boolean {
	const user = options.user ?? game.user;
	if (user?.isGM) return true;

	const isOwner = options.ownerOverride ?? combatant.isOwner;
	return combatant.type === 'character' && Boolean(isOwner);
}
