import type { InexactPartial } from '#types/utils';

declare namespace NimbleRoll {
	interface Data extends foundry.dice.Roll.Data {
		prompted?: boolean;
		respondentId?: string | null;
	}

	interface Options extends foundry.dice.Roll.Options {}

	type Evaluated<T extends NimbleRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

// @ts-expect-error
class NimbleRoll extends foundry.dice.Roll<NimbleRoll.Data> {
	constructor(
		formula: string,
		data?: InexactPartial<NimbleRoll.Data>,
		options?: NimbleRoll.Options,
	) {
		// @ts-expect-error
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
	static fromRoll(roll: any) {
		const newRoll = new NimbleRoll(roll.formula, roll.data, roll.options);
		Object.assign(newRoll, roll);
		return newRoll;
	}
}

export { NimbleRoll };
