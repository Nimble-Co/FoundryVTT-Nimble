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
