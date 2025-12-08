declare namespace NimbleRoll {
	interface Data extends foundry.dice.Roll.Data {
		prompted?: boolean;
		respondentId?: string | null;
		[key: string]: unknown;
	}

	interface Options extends foundry.dice.Roll.Options {}

	type Evaluated<T extends NimbleRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

class NimbleRoll extends foundry.dice.Roll<NimbleRoll.Data> {
	constructor(formula: string, data?: NimbleRoll.Data, options?: NimbleRoll.Options) {
		super(formula, data ?? ({} as NimbleRoll.Data), options);

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
	static fromRoll(roll: Roll): NimbleRoll {
		const newRoll = new NimbleRoll(
			roll.formula,
			roll.data as object as NimbleRoll.Data,
			roll.options,
		);
		Object.assign(newRoll, roll);
		return newRoll;
	}
}

export { NimbleRoll };
