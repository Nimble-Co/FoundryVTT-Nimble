interface SideToken {
	disposition?: number | null;
}

interface SideActor {
	type?: string;
	token?: SideToken | null;
	getActiveTokens?(linked?: boolean, document?: boolean): unknown[];
}

interface AttackCard {
	speaker?: { scene?: string | null; token?: string | null } | null;
}

/** The token that shows the actor's side: its own token, else its first active token. */
export function sideTokenOf(actor: SideActor): SideToken | null {
	if (actor.token) return actor.token;
	const [token] = actor.getActiveTokens?.(false, true) ?? [];
	return (token as SideToken | undefined) ?? null;
}

function speakerTokenOf(card: AttackCard | null | undefined): SideToken | null {
	const speaker = card?.speaker;
	if (!speaker?.scene || !speaker.token) return null;
	const scene = game.scenes?.get(speaker.scene) as
		| { tokens?: { get(id: string): SideToken | undefined } }
		| undefined;
	return scene?.tokens?.get(speaker.token) ?? null;
}

function dispositionOf(token: SideToken | null): number | null {
	const disposition = token?.disposition;
	return typeof disposition === 'number' ? disposition : null;
}

/**
 * Whether the attacker is an enemy of the holder: their tokens have different dispositions. The
 * attacker's token is the card speaker's, else the attacker's own. With no disposition on one
 * side, a character and a non-character are enemies.
 */
export function isEnemyAttacker(
	attacker: unknown,
	holder: unknown,
	card?: AttackCard | null,
): boolean {
	if (!attacker || !holder || attacker === holder) return false;
	const attackerActor = attacker as SideActor;
	const holderActor = holder as SideActor;
	const attackerSide = dispositionOf(speakerTokenOf(card) ?? sideTokenOf(attackerActor));
	const holderSide = dispositionOf(sideTokenOf(holderActor));
	if (attackerSide !== null && holderSide !== null) return attackerSide !== holderSide;
	return (attackerActor.type === 'character') !== (holderActor.type === 'character');
}
