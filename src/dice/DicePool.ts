declare namespace NimbleDicePool {
	/** Roll data for dice pools. */
	interface Data extends foundry.dice.Roll.Data {
		[key: string]: unknown;
	}

	/** Configuration options for dice pools. */
	interface Options extends foundry.dice.Roll.Options {
		/** A descriptive label for the dice pool. */
		label: string;
	}

	/**
	 * Represents an evaluated NimbleDicePool with guaranteed total value.
	 * @template T - The NimbleDicePool type being evaluated.
	 */
	type Evaluated<T extends NimbleDicePool> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

/**
 * A dice pool manager that allows dynamic manipulation of dice before rolling.
 *
 * NimbleDicePool extends Foundry's Roll class to provide:
 * - Tracking of dice counts by face value (e.g., how many d6s, d8s, etc.)
 * - Dynamic addition and removal of dice from the pool
 * - Reset functionality to restore the pool to its original state
 *
 * This is useful for systems that allow players to build up dice pools
 * before making a roll, such as adding bonus dice from abilities.
 *
 * @extends {foundry.dice.Roll<NimbleDicePool.Data>}
 *
 * @example
 * ```typescript
 * const pool = new NimbleDicePool("2d6+1d8", {}, { label: "Damage Pool" });
 * pool.addDieToPool(6, 1);  // Add another d6
 * pool.removeDieFromPool(8, 1);  // Remove the d8
 * await pool.evaluate();
 * ```
 */
class NimbleDicePool extends foundry.dice.Roll<NimbleDicePool.Data> {
	declare options: NimbleDicePool.Options;

	/** Map of die face counts to number of dice (e.g., 6 -> 2 means 2d6). */
	dieSizes: Map<number, number>;

	/** Total number of dice currently in the pool. */
	numDice = 0;

	/** The original formula before any modifications. */
	originalFormula: string;

	/**
	 * Creates a new NimbleDicePool instance.
	 *
	 * @param formula - The initial dice formula (e.g., "2d6+1d8").
	 * @param data - Roll data for formula variable resolution.
	 * @param options - Configuration options including the pool label.
	 */
	constructor(
		formula: string,
		data: NimbleDicePool.Data = {} as NimbleDicePool.Data,
		options?: NimbleDicePool.Options,
	) {
		super(formula, data, options);

		// Set Pool Data
		this.originalFormula = formula;

		// Get die sizes
		this.dieSizes = new Map();
		this.terms.forEach((term) => {
			if (term instanceof foundry.dice.terms.Die && term.faces && term.number) {
				if (this.dieSizes.has(term.faces)) {
					this.dieSizes.set(term.faces, this.dieSizes.get(term.faces)! + term.number);
				} else {
					this.dieSizes.set(term.faces, term.number);
				}

				// Increment number of dice in Pool
				this.numDice += term.number;
			}
		});
	}

	/**
	 * Gets the descriptive label for this dice pool.
	 * @returns The label configured in options.
	 */
	get label(): string {
		return this.options.label;
	}

	/**
	 * Gets the largest die size in the pool.
	 * @returns The maximum face count among all dice in the pool.
	 */
	get largestDie(): number {
		return Math.max(...Array.from(this.dieSizes.keys()));
	}

	/**
	 * Gets the smallest die size in the pool.
	 * @returns The minimum face count among all dice in the pool.
	 */
	get smallestDie(): number {
		return Math.min(...Array.from(this.dieSizes.keys()));
	}

	/**
	 * Adds dice to the pool.
	 *
	 * If dice of the specified size already exist in the pool, increments their count.
	 * Otherwise, creates a new die term with the specified size.
	 *
	 * @param dieSize - The face count of the die to add (e.g., 6 for a d6).
	 * @param value - The number of dice to add.
	 * @returns The updated roll formula after adding the dice.
	 */
	addDieToPool(dieSize: number, value: number) {
		if (this.dieSizes.has(dieSize)) {
			const term = this.terms.find(
				(t) => t instanceof foundry.dice.terms.Die && t.faces === dieSize,
			) as foundry.dice.terms.Die;

			if (!term) {
				ui.notifications?.error(`Could not find die term for d${dieSize} in roll ${this.formula}`);
				return this.formula;
			}

			term.number = (term.number ?? 0) + value;
			this.dieSizes.set(dieSize, this.dieSizes.get(dieSize)! + value);
			this.numDice += value;
			this.resetFormula();
			return this.formula;
		}

		// Create a new die term
		const term = new foundry.dice.terms.Die({
			number: value,
			faces: dieSize,
		});

		this.terms.push(term);
		this.dieSizes.set(dieSize, value);
		this.numDice += value;

		this.resetFormula();
		return this.formula;
	}

	/**
	 * Removes dice from the pool.
	 *
	 * If removing would reduce the count to zero or below, removes the die term entirely.
	 * Shows an error notification if the requested die size doesn't exist in the pool.
	 *
	 * @param dieSize - The face count of the die to remove (e.g., 6 for a d6).
	 * @param value - The number of dice to remove.
	 * @returns The updated roll formula after removing the dice.
	 */
	removeDieFromPool(dieSize: number, value: number) {
		if (!this.dieSizes.has(dieSize)) {
			ui.notifications?.error(`No d${dieSize} in roll ${this.formula}`);
			return this.formula;
		}
		const term = this.terms.find(
			(t) => t instanceof foundry.dice.terms.Die && t.faces === dieSize,
		) as foundry.dice.terms.Die;

		if (!term) {
			ui.notifications?.error(`Could not find die term for d${dieSize} in roll ${this.formula}`);
			return this.formula;
		}

		if ((term.number ?? 0) <= value) {
			this.terms = this.terms.filter((t) => t !== term);
			this.dieSizes.delete(dieSize);
		} else {
			term.number = (term.number ?? 0) - value;
			this.dieSizes.set(dieSize, this.dieSizes.get(dieSize)! - value);
		}

		this.numDice -= value;
		this.resetFormula();
		return this.formula;
	}

	/**
	 * Resets the dice pool to its original state.
	 *
	 * Recreates the pool from the original formula, discarding any
	 * dice that were added or removed since construction.
	 */
	resetPool() {
		const clean = new NimbleDicePool(this.originalFormula, this.data, this.options);
		this.terms = clean.terms;
		this.dieSizes = clean.dieSizes;
		this.numDice = clean.numDice;
		this.resetFormula();
	}

	/**
	 * Rolls dice from the pool.
	 *
	 * @todo Support multiple die sizes - currently not implemented.
	 */
	rollFromPool() {
		// TODO: Support multiple die sizes
	}
}

export { NimbleDicePool };
