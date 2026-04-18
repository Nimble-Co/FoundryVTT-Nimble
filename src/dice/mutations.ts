/**
 * Post-roll value mutation framework for the Nimble dice engine.
 *
 * Mutations are declarative instructions that modify die results after rolling
 * but before crit detection and explosion dispatch. Each mutation step targets
 * specific results and applies an operation, tagging the result with metadata
 * so downstream logic (crit counting, explosion) can make per-result decisions.
 *
 * @example Doomed: maximize all dice, counts as crit, no explosion
 * ```typescript
 * const step: MutationStep = {
 *     target: { kind: 'all' },
 *     operation: { type: 'max' },
 *     countsAsCrit: true,
 *     triggersExplosion: false,
 *     source: 'Doomed',
 * };
 * ```
 */

import { getNimbleMods } from './nimbleDieModifiers.js';
import type { PrimaryDie } from './terms/PrimaryDie.js';

// ─── Types ──────────────────────────────────────────────────────────

/** Which die results to target. */
type MutationTarget =
	| { kind: 'primary' }
	| { kind: 'all' }
	| { kind: 'tagged'; modifier: 'c' | 'cv' | 'n' }
	| { kind: 'index'; index: number };

/** What to do to the targeted results. */
type MutationOperation =
	| { type: 'set'; value: number }
	| { type: 'bump'; delta: number }
	| { type: 'max' }
	| { type: 'min' }
	| { type: 'floor'; minimum: number }
	| { type: 'ceiling'; maximum: number };

/** Metadata attached to a mutated die result. */
interface MutationMetadata {
	/** What the die actually rolled before mutation. */
	rolledValue: number;
	/** Source label for display (e.g. "Doomed", "Vicious Opportunist"). */
	source: string;
	/** Does the mutated value count as a crit if it equals max? */
	countsAsCrit: boolean;
	/** If countsAsCrit, does it also trigger explosion? */
	triggersExplosion: boolean;
}

/** A die result that may carry mutation metadata. */
interface MutatedResult extends foundry.dice.terms.DiceTerm.Result {
	mutation?: MutationMetadata;
}

/** A declarative instruction processed by the engine during _applyPostRollMutations. */
interface MutationStep {
	/** Which die results to target. */
	target: MutationTarget;
	/** What to do to the targeted results. */
	operation: MutationOperation;
	/** Does the mutated value count as a crit if it equals max? Default: false. */
	countsAsCrit?: boolean;
	/** If countsAsCrit, does it also trigger explosion? Default: false. */
	triggersExplosion?: boolean;
	/** Source label for chat card display (e.g. "Doomed", "Vicious Opportunist"). */
	source?: string;
}

// ─── Target Resolution ──────────────────────────────────────────────

/**
 * Resolve a MutationTarget to a list of `{ term, result }` pairs to mutate.
 *
 * For `primary` targets in modifier-mode (where primaryDie may not yet be
 * assigned), falls back to the leftmost Die with a `c` or `cv` modifier.
 */
function resolveTargets(
	target: MutationTarget,
	dieTerms: foundry.dice.terms.Die[],
	primaryDie: foundry.dice.terms.Die | PrimaryDie | undefined,
): Array<{ term: foundry.dice.terms.Die; result: MutatedResult }> {
	const hits: Array<{ term: foundry.dice.terms.Die; result: MutatedResult }> = [];

	switch (target.kind) {
		case 'primary': {
			// Use provided primaryDie; fall back to leftmost c/cv-tagged die
			let die = primaryDie;
			if (!die) {
				die = dieTerms.find((t) => {
					const meta = getNimbleMods(t);
					return meta?.canCrit === true;
				});
			}
			if (die) {
				for (const r of die.results) {
					if (r.active && !r.discarded) {
						hits.push({ term: die, result: r as MutatedResult });
					}
				}
			}
			break;
		}
		case 'all': {
			for (const term of dieTerms) {
				for (const r of term.results) {
					if (r.active && !r.discarded) {
						hits.push({ term, result: r as MutatedResult });
					}
				}
			}
			break;
		}
		case 'tagged': {
			const modifierToMatch = target.modifier;
			for (const term of dieTerms) {
				if (!Array.isArray(term.modifiers)) continue;
				// Match on the Nimble modifier token
				const hasModifier = term.modifiers.includes(modifierToMatch);
				if (!hasModifier) continue;
				for (const r of term.results) {
					if (r.active && !r.discarded) {
						hits.push({ term, result: r as MutatedResult });
					}
				}
			}
			break;
		}
		case 'index': {
			// Flatten all active results across all die terms, pick by index
			let idx = 0;
			for (const term of dieTerms) {
				for (const r of term.results) {
					if (r.active && !r.discarded) {
						if (idx === target.index) {
							hits.push({ term, result: r as MutatedResult });
							return hits;
						}
						idx++;
					}
				}
			}
			break;
		}
	}

	return hits;
}

// ─── Operation Application ──────────────────────────────────────────

/** Clamp a value to [1, faces]. */
function clamp(value: number, faces: number): number {
	return Math.max(1, Math.min(faces, value));
}

/**
 * Apply a single MutationStep to the given die terms.
 *
 * Resolves targets, applies the operation to each targeted result, and tags
 * each with mutation metadata preserving the original rolled value.
 *
 * @param step - The mutation step to apply.
 * @param dieTerms - All Die terms in the roll.
 * @param primaryDie - The current primary die reference (may be undefined in modifier-mode).
 */
function applyMutationStep(
	step: MutationStep,
	dieTerms: foundry.dice.terms.Die[],
	primaryDie: foundry.dice.terms.Die | PrimaryDie | undefined,
): void {
	const hits = resolveTargets(step.target, dieTerms, primaryDie);

	for (const { term, result } of hits) {
		const faces = term.faces ?? 6;
		const originalValue = result.result;
		const op = step.operation;

		switch (op.type) {
			case 'set':
				result.result = clamp(op.value, faces);
				break;
			case 'bump':
				result.result = clamp(result.result + op.delta, faces);
				break;
			case 'max':
				result.result = faces;
				break;
			case 'min':
				result.result = 1;
				break;
			case 'floor':
				if (result.result < op.minimum) {
					result.result = clamp(op.minimum, faces);
				}
				break;
			case 'ceiling':
				if (result.result > op.maximum) {
					result.result = clamp(op.maximum, faces);
				}
				break;
		}

		// Always tag mutation metadata, even if value didn't change
		(result as MutatedResult).mutation = {
			rolledValue: originalValue,
			source: step.source ?? 'unknown',
			countsAsCrit: step.countsAsCrit ?? false,
			triggersExplosion: step.triggersExplosion ?? false,
		};
	}
}

export { applyMutationStep };
export type { MutatedResult, MutationMetadata, MutationOperation, MutationStep, MutationTarget };
