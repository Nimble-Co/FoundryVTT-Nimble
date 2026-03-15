import type { NimbleRollData } from '#types/rollData.d.ts';

declare namespace NimbleRoll {
	/**
	 * Roll data for NimbleRoll, extending the base roll data with prompt tracking.
	 */
	type Data = NimbleRollData & {
		/** Whether this roll was prompted to the user for input. */
		prompted?: boolean;
		/** The ID of the user who responded to the roll prompt, or null if not prompted. */
		respondentId?: string | null;
	};

	/** Options for configuring a NimbleRoll. */
	type Options = foundry.dice.Roll.Options;

	/**
	 * Represents an evaluated NimbleRoll with guaranteed total value.
	 * @template T - The NimbleRoll type being evaluated.
	 */
	type Evaluated<T extends NimbleRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

/**
 * A custom roll class extending Foundry's Roll system with additional data tracking
 * for the Nimble system. Tracks whether rolls were prompted and who responded.
 *
 * @extends {foundry.dice.Roll<NimbleRoll.Data>}
 *
 * @example
 * ```typescript
 * const roll = new NimbleRoll("1d20+5", { prompted: true });
 * await roll.evaluate();
 * console.log(roll.total);
 * ```
 */
class NimbleRoll extends foundry.dice.Roll<NimbleRoll.Data> {
	/**
	 * Creates a new NimbleRoll instance.
	 *
	 * @param formula - The dice formula to roll (e.g., "1d20+5").
	 * @param data - Roll data containing actor/item attributes and prompt tracking.
	 * @param options - Additional options for the roll.
	 */
	constructor(formula: string, data: NimbleRoll.Data = {}, options?: NimbleRoll.Options) {
		super(formula, data, options);

		// Setup Defaults
		this.data.prompted ??= false;
		this.data.respondentId ??= null;
	}

	/**
	 * Serializes the roll to a JSON-compatible object for storage or transmission.
	 *
	 * @returns The serialized roll data including all NimbleRoll-specific properties.
	 */
	override toJSON() {
		return {
			...super.toJSON(),
			data: this.data,
		};
	}

	/** ------------------------------------------------------ */
	/**                    Static Methods                      */
	/** ------------------------------------------------------ */

	/**
	 * Converts a standard Foundry Roll into a NimbleRoll instance.
	 *
	 * @template D - The type of roll data.
	 * @param roll - The Roll instance to convert.
	 * @returns A new NimbleRoll with the same formula, data, and evaluated state.
	 */
	static fromRoll<D extends NimbleRoll.Data>(roll: Roll<D>): NimbleRoll {
		const newRoll = new NimbleRoll(roll.formula, roll.data, roll.options);
		Object.assign(newRoll, roll);
		return newRoll;
	}
}

export { NimbleRoll };
