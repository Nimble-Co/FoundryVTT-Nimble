import type { CardCreature } from '#types/movement.js';

/**
 * The users a whispered movement card goes to: every GM, each player who owns
 * one of the card's creatures, and the user who posts it. The author is always
 * in the list, because a user who is not a recipient sees only a placeholder.
 */
export function movementCardWhisper(
	creatures: Iterable<CardCreature | null | undefined>,
): string[] {
	const owned = [...creatures].filter((creature) => creature != null);
	const recipients = new Set<string>();

	for (const user of game.users ?? []) {
		if (!user.id) continue;
		const owns = owned.some((creature) =>
			creature.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
		);
		if (user.isGM || owns) recipients.add(user.id);
	}

	if (game.user?.id) recipients.add(game.user.id);
	return [...recipients];
}
