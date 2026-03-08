import type { NimbleRollData } from '#types/rollData.d.ts';

declare namespace NimbleRoll {
	type Data = NimbleRollData & {
		prompted?: boolean;
		respondentId?: string | null;
	};

	type Options = foundry.dice.Roll.Options;

	type Evaluated<T extends NimbleRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

class NimbleRoll extends foundry.dice.Roll<NimbleRoll.Data> {
	constructor(formula: string, data: NimbleRoll.Data = {}, options?: NimbleRoll.Options) {
		super(formula, data, options);

		// Setup Defaults
		this.data.prompted ??= false;
		this.data.respondentId ??= null;
	}

	/** Finds the first die-like term from this roll's terms list. */
	private _primaryDieTerm():
		| { faces: number; results: { active: boolean; discarded?: boolean; result: number }[] }
		| undefined {
		return (this.terms as unknown[]).find(
			(
				t,
			): t is {
				faces: number;
				results: { active: boolean; discarded?: boolean; result: number }[];
			} => typeof t === 'object' && t !== null && 'faces' in t && 'results' in t,
		);
	}

	/** Returns true if the primary die rolled its maximum face value (natural max). Undefined if not yet evaluated. */
	get isCriticalSuccess(): boolean | undefined {
		if (!this._evaluated) return undefined;
		const dieTerm = this._primaryDieTerm();
		if (!dieTerm?.results?.length) return undefined;
		return dieTerm.results.some((r) => r.active && !r.discarded && r.result === dieTerm.faces);
	}

	/** Returns true if the primary die rolled a 1. Undefined if not yet evaluated. */
	get isCriticalFailure(): boolean | undefined {
		if (!this._evaluated) return undefined;
		const dieTerm = this._primaryDieTerm();
		if (!dieTerm?.results?.length) return undefined;
		return dieTerm.results.some((r) => r.active && !r.discarded && r.result === 1);
	}

	override toJSON() {
		return {
			...super.toJSON(),
			data: this.data,
		};
	}

	/** ------------------------------------------------------ */
	/**                    Static Methods                      */
	/** ------------------------------------------------------ */
	static fromRoll<D extends NimbleRoll.Data>(roll: Roll<D>): NimbleRoll {
		const newRoll = new NimbleRoll(roll.formula, roll.data, roll.options);
		Object.assign(newRoll, roll);
		return newRoll;
	}
}

export { NimbleRoll };
