/**
 * Pragmatic prototype-token defaults shared by NPC, minion, and solo-monster
 * actors. These mirror — and deliberately invert — the player-character defaults
 * (which are friendly + linked): adversaries are hostile and unlinked so each
 * dropped token tracks its own HP. Sight is enabled to match the world's default
 * token configuration; Nimble has no darkvision, so range stays 0.
 *
 * Solo monsters override `actorLink` to true (a single boss-tier creature is one
 * tracked token) — see `soloMonster.ts`.
 *
 * Disposition and actorLink already match Foundry's schema defaults, but they are
 * set explicitly here so a GM who customizes the global Default Token Configuration
 * (e.g. flips it to friendly or linked) does not accidentally change how monsters
 * arrive. A fresh object is returned per call so callers can pass it straight to
 * `updateSource` without sharing mutable state.
 */
export function buildMonsterPrototypeTokenDefaults(): {
	sight: { enabled: boolean };
	actorLink: boolean;
	disposition: number;
} {
	return {
		sight: { enabled: true },
		actorLink: false,
		disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
	};
}
