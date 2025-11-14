declare namespace NimbleDicePool {
	interface Data extends foundry.dice.Roll.Data {}

	interface Options extends foundry.dice.Roll.Options {
		label: string;
	}

	type Evaluated<T extends NimbleDicePool> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

class NimbleDicePool extends foundry.dice.Roll {
	declare options: NimbleDicePool.Options;

	dieSizes: Map<number, number>;

	numDice = 0;

	originalFormula: string;

	constructor(formula: string, data?: NimbleDicePool.Data, options?: NimbleDicePool.Options) {
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

	get label(): string {
		return this.options.label;
	}

	get largestDie(): number {
		return Math.max(...Array.from(this.dieSizes.keys()));
	}

	get smallestDie(): number {
		return Math.min(...Array.from(this.dieSizes.keys()));
	}

	addDieToPool(dieSize: number, value: number) {
		if (this.dieSizes.has(dieSize)) {
			const term = this.terms.find(
				(t) => t instanceof foundry.dice.terms.Die && t.faces === dieSize,
			) as foundry.dice.terms.Die;

			if (!term) {
				ui.notifications?.error(`Could not find die term for d${dieSize} in roll ${this.formula}`);
				return this.formula;
			}

			// @ts-expect-error
			term.number += value;
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

		// @ts-expect-error
		if (term.number <= value) {
			this.terms = this.terms.filter((t) => t !== term);
			this.dieSizes.delete(dieSize);
		} else {
			// @ts-expect-error
			term.number -= value;
			this.dieSizes.set(dieSize, this.dieSizes.get(dieSize)! - value);
		}

		this.numDice -= value;
		this.resetFormula();
		return this.formula;
	}

	resetPool() {
		const clean = new NimbleDicePool(this.originalFormula, this.data, this.options);
		this.terms = clean.terms;
		this.dieSizes = clean.dieSizes;
		this.numDice = clean.numDice;
		this.resetFormula();
	}

	rollFromPool() {
		// TODO: Support multiple die sizes
	}
}

export { NimbleDicePool };
