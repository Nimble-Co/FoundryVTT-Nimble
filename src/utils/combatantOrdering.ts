type UserLike = {
	isGM?: boolean;
	role?: number;
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

export function isUserTrustedPlayerOrHigher(user: UserLike = game.user): boolean {
	const trustedRoleValue = Number(CONST.USER_ROLES?.TRUSTED ?? 2);
	return Number(user?.role ?? 0) >= trustedRoleValue;
}

export function canCurrentUserReorderCombatant(
	combatant: Combatant.Implementation,
	options: ReorderOptions = {},
): boolean {
	const user = options.user ?? game.user;
	if (user?.isGM) return true;

	const isOwner = options.ownerOverride ?? combatant.isOwner;
	return isUserTrustedPlayerOrHigher(user) && combatant.type === 'character' && Boolean(isOwner);
}
