import type { InexactPartial } from 'fvtt-types/utils';

declare namespace PrimaryDie {
	interface TermData extends foundry.dice.terms.Die.TermData {}
}

class PrimaryDie extends foundry.dice.terms.Die {
	constructor(termData?: InexactPartial<PrimaryDie.TermData>) {
		super(termData);
		if (!this.modifiers) this.modifiers = [];
	}

	get exploded() {
		if (!this._evaluated) return undefined;
		return this.results.some((r) => r.exploded && r.active && !r.discarded);
	}

	get isMiss() {
		if (!this._evaluated) return undefined;
		// If any active die exploded (crit), this cannot be a miss
		// This prevents explosion results that rolled 1 from being flagged as misses
		if (this.exploded) return false;
		return this.results.some((r) => r.result === 1 && r.active && !r.discarded);
	}
}

export { PrimaryDie };
