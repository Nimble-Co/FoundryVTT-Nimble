/** Movement actions a character can have a Speed of its own for. */
const ACTION_SPEEDS = new Set(['walk', 'fly', 'swim', 'climb', 'burrow']);

interface CombatLike {
	started?: boolean;
	combatant?: { tokenId: string | null; sceneId: string | null } | null;
}

interface MovingToken {
	id: string | null;
	parent?: { id?: string | null } | null;
	actor?: {
		type?: string;
		system?: { attributes?: { movement?: Partial<Record<string, number>> } };
	} | null;
}

export interface MoveBandOptions {
	speedFor(action: string): number;
}

/**
 * How a character's own movement splits into Moves while its token is dragged
 * on its own turn in a started combat: each Move goes up to its Speed. A
 * movement action with a Speed of its own, such as fly, uses that Speed; every
 * other action uses the walking Speed. Null for any other creature or moment.
 * The Moves only draw, so no setting turns them off.
 */
export function getMoveBandOptions(
	token: MovingToken,
	combats: Iterable<CombatLike> = (game.combats ?? []) as Iterable<CombatLike>,
): MoveBandOptions | null {
	const actor = token.actor;
	if (actor?.type !== 'character') return null;
	const sceneId = token.parent?.id ?? null;
	for (const combat of combats) {
		const combatant = combat.combatant;
		if (!combat.started || combatant?.tokenId !== token.id || combatant.sceneId !== sceneId)
			continue;
		const movement = actor.system?.attributes?.movement ?? {};
		const walk = movement.walk ?? 0;
		return {
			speedFor: (action) => {
				const speed = ACTION_SPEEDS.has(action) ? (movement[action] ?? 0) : 0;
				return speed > 0 ? speed : walk;
			},
		};
	}
	return null;
}
