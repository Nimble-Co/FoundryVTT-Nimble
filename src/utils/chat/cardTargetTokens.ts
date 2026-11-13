interface TargetToken {
	actor?: unknown;
}

/** A card's target tokens, one for each actor: the first token the card names for it. */
export function cardTargetTokens<Token extends TargetToken>(card: { system?: unknown }): Token[] {
	const targets = (card.system as { targets?: string[] } | null | undefined)?.targets ?? [];
	const byActor = new Map<unknown, Token>();
	for (const uuid of targets) {
		const token = fromUuidSync(uuid as never, { strict: false }) as Token | null;
		if (token?.actor && !byActor.has(token.actor)) byActor.set(token.actor, token);
	}
	return [...byActor.values()];
}
