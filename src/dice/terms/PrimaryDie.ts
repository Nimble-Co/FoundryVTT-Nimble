declare namespace PrimaryDie {
	interface TermData {
		number?: number;
		faces?: number;
		modifiers?: string[];
		options?: { flavor?: string };
	}
}

class PrimaryDie extends foundry.dice.terms.Die {
	constructor(termData: PrimaryDie.TermData) {
		super(termData as foundry.dice.terms.Die.TermData);
		if (!this.modifiers) this.modifiers = [];
	}

	get exploded() {
		if (!this._evaluated) return undefined;
		return this.results.some((r) => r.exploded);
	}

	get isMiss() {
		if (!this._evaluated) return undefined;
		return this.results.some((r) => r.result === 1 && r.active && !r.discarded && !r.exploded);
	}
}

export { PrimaryDie };
