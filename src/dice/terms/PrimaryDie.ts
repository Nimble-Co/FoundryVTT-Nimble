import type { InexactPartial } from 'fvtt-types/utils';

declare namespace PrimaryDie {
	/** Term data for configuring a PrimaryDie. */
	interface TermData extends foundry.dice.terms.Die.TermData {}
}

/**
 * A specialized die term that tracks critical hit and miss status for damage rolls.
 *
 * PrimaryDie extends Foundry's Die term to provide:
 * - `exploded` getter: Checks if the die exploded (rolled max value), indicating a critical hit
 * - `isMiss` getter: Checks if the die rolled a 1, indicating a miss
 *
 * This term is automatically created by DamageRoll when processing the first die in a formula.
 * The explosion modifier ('x') is added to detect critical hits.
 *
 * @extends {foundry.dice.terms.Die}
 *
 * @example
 * ```typescript
 * const primary = new PrimaryDie({ number: 1, faces: 6, modifiers: ['x'] });
 * await primary.evaluate();
 * if (primary.exploded) console.log("Critical!");
 * if (primary.isMiss) console.log("Miss!");
 * ```
 */
class PrimaryDie extends foundry.dice.terms.Die {
	/**
	 * Creates a new PrimaryDie instance.
	 *
	 * @param termData - Configuration for the die including number, faces, and modifiers.
	 */
	constructor(termData?: InexactPartial<PrimaryDie.TermData>) {
		super(termData);
		if (!this.modifiers) this.modifiers = [];
	}

	/**
	 * Whether the die exploded (rolled maximum value), indicating a critical hit.
	 *
	 * @returns `true` if any result exploded, `false` if none did, or `undefined` if not yet evaluated.
	 */
	get exploded() {
		if (!this._evaluated) return undefined;
		return this.results.some((r) => r.exploded);
	}

	/**
	 * Whether the die resulted in a miss (rolled a 1 on an active, non-discarded result).
	 *
	 * A result is considered a miss if it:
	 * - Has a value of 1
	 * - Is marked as active
	 * - Is not discarded (e.g., from keep highest/lowest)
	 * - The roll did not explode (crits cannot be misses)
	 *
	 * @returns `true` if the roll is a miss, `false` if not, or `undefined` if not yet evaluated.
	 */
	get isMiss() {
		if (!this._evaluated) return undefined;
		if (this.exploded) return false;
		return this.results.some((r) => r.result === 1 && r.active && !r.discarded);
	}
}

export { PrimaryDie };
