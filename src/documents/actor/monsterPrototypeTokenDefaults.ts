/**
 * Pragmatic prototype-token defaults shared by NPC, minion, and solo-monster
 * actors. These mirror — and deliberately invert — the player-character defaults
 * (which are friendly + linked): adversaries are hostile and unlinked so each
 * dropped token tracks its own HP. Sight is enabled explicitly; Nimble has no
 * darkvision, so range stays 0.
 *
 * Solo monsters override `actorLink` to true (a single boss-tier creature is one
 * tracked token) — see `soloMonster.ts`.
 *
 * V14 removed the world-level default token configuration (`core.defaultToken`),
 * so per-create seeding here is the only remaining mechanism for these defaults.
 * `displayBars` is seeded because the schema default is NONE, which would hide
 * the HP bar mapping entirely. A fresh object is returned per call so callers
 * can pass it straight to `updateSource` without sharing mutable state.
 */
export function buildMonsterPrototypeTokenDefaults(): {
	sight: { enabled: boolean };
	actorLink: boolean;
	disposition: number;
	displayBars: number;
} {
	return {
		sight: { enabled: true },
		actorLink: false,
		disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
	};
}
