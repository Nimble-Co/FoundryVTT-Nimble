/**
 * Reroll protocol types for the Nimble dice engine.
 *
 * Two variants are supported:
 *   - Whole-roll reroll: re-evaluates the whole `DamageRoll` from its
 *     `originalFormula`, optionally adjusting rollMode (advantage/disadvantage)
 *     or prepending mutations. Used by Inerrant Strike, Mountain's Endurance,
 *     FAST, Pocket Sand, etc.
 *   - Single-die reroll: re-rolls one die in-place on a copy of the existing
 *     roll and re-runs finalization. Used by Songweaver's Inspiration,
 *     Optimistic (Gnome), Elemental Destruction, etc.
 *
 * `KeepPolicy` is a hint for the CALLER (rules layer) — the engine always
 * produces the rerolled roll; comparing and picking the winner is a rules-layer
 * decision, not engine logic.
 */

import type { MutationStep } from './mutations.js';

/** Reroll the entire evaluated roll from `originalFormula`, with adjustments. */
interface WholeRerollRequest {
	kind: 'whole';
	/** Signed integer added to rollMode / appended to rollModeSources. */
	rollModeAdjust?: number;
	/** Mutations to apply on the reroll (e.g. Inerrant Strike: bump +1). */
	mutations?: MutationStep[];
	/** Source label (used in logs / chat card). */
	source: string;
}

/** Reroll a single active die result in-place on a copy of the evaluated roll. */
interface SingleDieRerollRequest {
	kind: 'single';
	/** Index into flattened active (non-discarded) die results. */
	dieIndex: number;
	/** Source label (used in logs / chat card). */
	source: string;
}

type RerollRequest = WholeRerollRequest | SingleDieRerollRequest;

/**
 * Policy hint for the caller when comparing original vs. rerolled results.
 * Not consumed by the engine.
 */
type KeepPolicy = 'higher' | 'lower' | 'either' | 'new';

export type { KeepPolicy, RerollRequest, SingleDieRerollRequest, WholeRerollRequest };
