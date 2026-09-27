import { isInStartedCombat } from './isInStartedCombat.js';

interface TokenBearingActor {
	isToken?: boolean;
	token?: TokenDocument | null;
	getDependentTokens?(options?: { linked?: boolean; concreteOnly?: boolean }): TokenDocument[];
}

interface SceneCollection {
	viewed?: Scene | null;
	active?: Scene | null;
}

/**
 * The token that stands for an actor, found without the canvas, so it works on
 * a client that views another scene or has no canvas. In order: a synthetic
 * actor's own token; its token in a started combat; on the viewed scene; on
 * the active scene; on any scene. Only linked tokens stand for a world actor,
 * because an unlinked token has an actor of its own.
 */
export function findActorToken(actor: Actor | null | undefined): TokenDocument | null {
	const source = actor as TokenBearingActor | null | undefined;
	if (!source) return null;
	if (source.isToken) return source.token ?? null;

	const tokens = source.getDependentTokens?.({ linked: true, concreteOnly: true }) ?? [];
	const scenes = game.scenes as unknown as SceneCollection | undefined;
	const viewed = scenes?.viewed ?? null;
	const active = scenes?.active ?? null;
	return (
		tokens.find((token) => isInStartedCombat(token)) ??
		(viewed && tokens.find((token) => token.parent === viewed)) ??
		(active && tokens.find((token) => token.parent === active)) ??
		tokens[0] ??
		null
	);
}
