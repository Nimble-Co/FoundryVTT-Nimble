import type { AnyObject, FixedInstanceType } from 'fvtt-types/utils';
import type { InexactPartial } from '#types/utils.js';

import { PrimaryDie } from './terms/PrimaryDie.js';

const Terms = foundry.dice.terms;

declare namespace DamageRoll {
	/** Roll data for damage rolls. */
	interface Data extends Record<string, number | string | boolean | object | null> {}

	/** Configuration options for damage rolls. */
	interface Options extends foundry.dice.Roll.Options {
		/** Whether this roll can score a critical hit (exploding die). */
		canCrit: boolean;
		/** Whether this roll can miss (rolling a 1 on the primary die). */
		canMiss: boolean;
		/** The minimum roll value needed to score a critical hit. */
		criticalThreshold?: number;
		/** The damage type for this roll (e.g., "fire", "slashing"). */
		damageType?: string;
		/** The maximum roll value that counts as a fumble/miss. */
		fumbleThreshold?: number;
		/** The roll mode: positive for advantage, negative for disadvantage, 0 for normal. */
		rollMode: number;
		/** A predetermined value for the primary die result. */
		primaryDieValue: number;
		/** A modifier to add to the primary die result. */
		primaryDieModifier: number;
		/**
		 * Whether the primary die's base result contributes to damage.
		 * When false, the primary die is used only for hit/miss/crit detection,
		 * and its base value is excluded from damage (explosions still count).
		 * Default: true
		 */
		primaryDieAsDamage?: boolean;
		/**
		 * Whether the weapon has the vicious property.
		 * When true, explosions roll 2 dice instead of 1, but only the left die
		 * can continue to explode.
		 * Default: false
		 */
		isVicious?: boolean;
	}

	/** Data structure for serializing/deserializing a DamageRoll. */
	interface SerializedData {
		formula: string;
		terms?: foundry.dice.Roll.Data['terms'] | foundry.dice.terms.RollTerm[] | object[];
		results?: Array<number | string>;
		total?: number | null;
		class?: string;
		data?: Data;
		options?:
			| (Partial<Options> & { isCritical?: boolean; isMiss?: boolean })
			| Record<string, boolean | number | string | null | undefined>
			| null;
		originalFormula?: string;
		evaluated?: boolean;
		isCritical?: boolean;
		isMiss?: boolean;
		_total?: number;
		_formula?: string;
		excludedPrimaryDieValue?: number;
	}

	/**
	 * Represents an evaluated DamageRoll with guaranteed total value.
	 * @template T - The DamageRoll type being evaluated.
	 */
	type Evaluated<T extends DamageRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

/**
 * A specialized roll class for handling damage calculations in the Nimble system.
 *
 * DamageRoll extends Foundry's Roll class with support for:
 * - Critical hit detection via exploding primary dice
 * - Miss detection when rolling a 1 on the primary die
 * - Advantage/disadvantage on damage (roll multiple primary dice, keep highest/lowest)
 * - Automatic separation and tracking of the "primary die" from the formula
 *
 * The primary die is the first die term in the formula and determines critical/miss status.
 * When the primary die explodes (rolls max value), the roll is a critical hit.
 * When the primary die rolls a 1, the roll is a miss.
 *
 * @extends {foundry.dice.Roll<DamageRoll.Data>}
 *
 * @example
 * ```typescript
 * const roll = new DamageRoll("2d6+3", actorData, { canCrit: true, canMiss: true, rollMode: 0 });
 * await roll.evaluate();
 * if (roll.isCritical) console.log("Critical hit!");
 * if (roll.isMiss) console.log("Miss!");
 * ```
 */
class DamageRoll extends foundry.dice.Roll<DamageRoll.Data> {
	declare options: DamageRoll.Options;

	/** Whether this roll resulted in a critical hit. Undefined until evaluated. */
	isCritical: undefined | boolean = undefined;

	/** Whether this roll resulted in a miss. Undefined until evaluated. */
	isMiss: undefined | boolean = undefined;

	/** The original formula before preprocessing (e.g., before primary die extraction). */
	originalFormula: string;

	/** The primary die term used for critical/miss detection. */
	primaryDie: PrimaryDie | undefined = undefined;

	override _formula: string = '';

	/**
	 * The base value of the primary die that was excluded from damage
	 * (only set when primaryDieAsDamage is false)
	 */
	excludedPrimaryDieValue: number = 0;

	/*
	 * Creates a new DamageRoll instance.
	 *
	 * @param formula - The dice formula for the damage roll (e.g., "2d6+3").
	 * @param data - Roll data containing actor/item attributes for formula resolution.
	 * @param options - Configuration options including critical/miss settings and roll mode.
	 */
	constructor(formula: string, data: DamageRoll.Data = {}, options?: DamageRoll.Options) {
		super(formula, data, options);

		// Setup Defaults
		this.options.canCrit ??= true;
		this.options.canMiss ??= true;
		this.options.rollMode ??= 0;
		this.options.primaryDieAsDamage ??= true;
		this.originalFormula = formula;
		this._formula = formula;

		if (!this.options.canCrit) this.isCritical = false;
		if (!this.options.canMiss) this.isMiss = false;

		this._preProcessFormula(
			formula,
			this.data ?? ({} as DamageRoll.Data),
			(this.options ?? {}) as DamageRoll.Options,
		);
	}

	/** ------------------------------------------------------ */
	/**                  Data Prep Helpers                     */
	/** ------------------------------------------------------ */

	/**
	 * Applies advantage or disadvantage to a die term.
	 *
	 * Adds extra dice and a keep modifier based on rollMode:
	 * - Positive rollMode (advantage): adds dice and keeps highest N (original count)
	 * - Negative rollMode (disadvantage): adds dice and keeps lowest N (original count)
	 *
	 * @param dieTerm - The die term to modify.
	 * @param rollMode - Positive for advantage, negative for disadvantage.
	 * @param keepCount - Number of dice to keep (defaults to original die count).
	 */
	private _applyRollMode(
		dieTerm: foundry.dice.terms.Die,
		rollMode: number,
		keepCount?: number,
	): void {
		if (!rollMode) return;

		const originalCount = dieTerm.number ?? 1;
		const keep = keepCount ?? originalCount;

		dieTerm.number = originalCount + Math.abs(rollMode);
		if (!dieTerm.modifiers) dieTerm.modifiers = [];

		if (rollMode > 0) {
			dieTerm.modifiers.push(keep === 1 ? 'kh' : `kh${keep}`);
		} else {
			dieTerm.modifiers.push(keep === 1 ? 'kl' : `kl${keep}`);
		}
	}

	/**
	 * Extracts and configures a primary die from the first die term.
	 *
	 * The primary die is used for critical hit and miss detection. It is configured with:
	 * - Explosion modifier ('x') for critical detection if canCrit is true
	 * - Keep highest ('kh') or keep lowest ('kl') modifiers based on rollMode
	 *
	 * @param options - Roll options containing canCrit, canMiss, rollMode, and preset values.
	 */
	private _extractPrimaryDie(options: DamageRoll.Options): void {
		const { rollMode = 0, isVicious = false } = options;
		const shouldExplode = options.canCrit;
		const firstDieTerm = this.terms.find((t) => t instanceof Terms.Die);

		if (!firstDieTerm) return;

		const { number = 1, faces } = firstDieTerm;
		let primaryTerm: PrimaryDie;

		if (number > 1) {
			// Multi-die formula: extract one die as primary, leave rest as damage
			firstDieTerm.number = (number ?? 1) - 1;

			const operatorTerm = new Terms.OperatorTerm({ operator: '+' });
			this.terms.unshift(operatorTerm);

			primaryTerm = new PrimaryDie({
				number: 1,
				faces: faces ?? 6,
				modifiers: [],
				options: { flavor: 'Primary Die', isVicious },
			});

			// Apply advantage/disadvantage to primary die only (keeps 1)
			this._applyRollMode(primaryTerm, rollMode, 1);

			// Only add explosion modifier for non-vicious weapons
			// Vicious weapons handle explosion manually after evaluation to avoid preemptive rolls
			if (shouldExplode && !isVicious) primaryTerm.modifiers.push('x');

			this._applyPrimaryDiePresets(primaryTerm, options);
			this.terms.unshift(primaryTerm);
		} else {
			// Single-die formula: convert to PrimaryDie
			primaryTerm = new PrimaryDie({
				number: 1,
				faces: firstDieTerm.faces ?? 6,
				modifiers: [],
				options: { isVicious },
			});

			// Apply advantage/disadvantage (keeps 1)
			this._applyRollMode(primaryTerm, rollMode, 1);

			// Only add explosion modifier for non-vicious weapons
			// Vicious weapons handle explosion manually after evaluation to avoid preemptive rolls
			if (shouldExplode && !isVicious) primaryTerm.modifiers.push('x');

			this._applyPrimaryDiePresets(primaryTerm, options);

			const idx = this.terms.findIndex((t) => t instanceof Terms.Die);
			if (idx !== -1) this.terms[idx] = primaryTerm;
		}

		this.primaryDie = primaryTerm;
	}

	/**
	 * Applies preset values to a primary die term.
	 *
	 * @param primaryTerm - The primary die to configure.
	 * @param options - Roll options containing primaryDieValue and primaryDieModifier.
	 */
	private _applyPrimaryDiePresets(primaryTerm: PrimaryDie, options: DamageRoll.Options): void {
		if (options.primaryDieValue) {
			primaryTerm.results = [{ result: options.primaryDieValue, active: true }];
		}

		const faces = primaryTerm.faces;
		if (options.primaryDieModifier && faces) {
			const baseResult = Math.ceil(Math.random() * faces);
			const modifiedResult = baseResult + options.primaryDieModifier;
			if (modifiedResult > faces) {
				primaryTerm.results = [{ result: faces, active: true }];
				const excess = modifiedResult - faces;
				const excessTerm = new Terms.NumericTerm({ number: excess });
				const operatorTermExcess = new Terms.OperatorTerm({ operator: '+' });
				this.terms.splice(this.terms.indexOf(primaryTerm) + 1, 0, operatorTermExcess, excessTerm);
			} else {
				primaryTerm.results = [{ result: modifiedResult, active: true }];
			}
		}
	}

	/**
	 * Preprocesses the roll formula based on roll options.
	 *
	 * Handles two scenarios:
	 * 1. Primary die extraction: When canCrit or canMiss is true, extracts the first die
	 *    as a primary die for hit/miss/crit detection.
	 * 2. AoE advantage/disadvantage: When neither canCrit nor canMiss is true but rollMode
	 *    is set, applies advantage/disadvantage directly to the first die term.
	 *
	 * @param _formula - The original dice formula (unused, kept for signature compatibility).
	 * @param _data - Roll data (unused, kept for signature compatibility).
	 * @param options - Roll options containing canCrit, canMiss, and rollMode settings.
	 */
	_preProcessFormula(_formula: string, _data: DamageRoll.Data, options: DamageRoll.Options) {
		const { rollMode = 0 } = options;
		const needsPrimaryDie = options.canCrit || options.canMiss;

		if (!needsPrimaryDie && !rollMode) return;

		const firstDieTerm = this.terms.find((t) => t instanceof Terms.Die);
		if (!firstDieTerm) return;

		if (needsPrimaryDie) {
			// Extract primary die for crit/miss detection
			this._extractPrimaryDie(options);
		} else if (rollMode) {
			// AoE case: apply advantage/disadvantage to entire first die term
			// 2d8 with advantage → 3d8kh2
			this._applyRollMode(firstDieTerm, rollMode);
		}

		this.resetFormula();
	}

	/** ------------------------------------------------------ */
	/**                       Helpers                          */
	/** ------------------------------------------------------ */

	/**
	 * Updates the face count of the primary die term.
	 *
	 * Use this method to change the primary die size after roll creation
	 * (e.g., when a feature modifies the damage die).
	 *
	 * @param dieSize - The new number of faces for the primary die (e.g., 8 for a d8).
	 */
	updatePrimaryTerm(dieSize: number) {
		if (!this.primaryDie) return;

		const primaryTerm = this.terms.find((t) => t instanceof PrimaryDie);
		if (!primaryTerm) {
			ui.notifications?.error(`No primary die term found in roll ${this.formula}`);
			return;
		}

		primaryTerm.faces = dieSize;
		this.primaryDie = primaryTerm;
		this.resetFormula();
	}

	/** ------------------------------------------------------ */
	/**                       Overrides                        */
	/** ------------------------------------------------------ */

	/**
	 * Evaluates the roll and determines critical/miss status.
	 *
	 * After evaluation, checks the primary die's results to determine:
	 * - `isCritical`: true if the primary die exploded (rolled max value)
	 * - `isMiss`: true if the primary die rolled a 1
	 *
	 * For vicious weapons, explosion dice are rolled manually after the initial roll
	 * to avoid preemptive rolling that would show in visual dice mods like Dice So Nice.
	 *
	 * @param options - Evaluation options passed to the parent Roll class.
	 * @returns The evaluated roll with isCritical and isMiss populated.
	 */
	override async _evaluate(
		options?: InexactPartial<foundry.dice.Roll.Options>,
	): Promise<DamageRoll.Evaluated<this>> {
		await super._evaluate(options);

		const primaryTerm = this.terms.find((t) => t instanceof PrimaryDie);

		if (primaryTerm) {
			const isVicious = this.options.isVicious ?? false;

			// For vicious weapons, handle explosion manually after initial roll
			if (isVicious && this.options.canCrit) {
				await this._evaluateViciousExplosion(primaryTerm);
			}

			// Determine crit status
			// For non-vicious: check if the 'x' modifier caused explosion
			// For vicious: check if we manually triggered explosion (marked with exploded flag)
			if (this.options.canCrit) {
				if (isVicious) {
					// Check if any result was marked as exploded during vicious explosion
					this.isCritical = primaryTerm.results.some((r) => r.exploded);
				} else {
					this.isCritical = primaryTerm.exploded;
				}
			}

			if (this.options.canMiss) this.isMiss = primaryTerm.isMiss;

			// Recalculate total if vicious explosion added dice
			// This must happen BEFORE primaryDieAsDamage exclusion to avoid double-counting
			if (isVicious && this.isCritical) {
				this._recalculateTotal();
			}

			// When primaryDieAsDamage is false, exclude the base die value from damage
			// (explosions still count toward damage)
			if (!this.options.primaryDieAsDamage) {
				// Find the first result (the base roll, not explosion rolls)
				// The base result is the one that may have exploded: true flag
				const baseResult = primaryTerm.results.find((r) => r.active && !r.discarded);
				if (baseResult) {
					this.excludedPrimaryDieValue = baseResult.result;
					// Adjust the total by subtracting the base die value
					const internals = this as object as { _total: number };
					internals._total = (this._total ?? 0) - this.excludedPrimaryDieValue;
				}
			}
		}

		return this as DamageRoll.Evaluated<this>;
	}

	/**
	 * Handles vicious weapon explosion manually after initial roll.
	 *
	 * Vicious explosion rules:
	 * 1. If initial die = max, roll 2 explosion dice
	 * 2. Left die can chain explode, right die cannot
	 * 3. If left die = max, roll 2 more dice
	 * 4. Continue until left die is NOT max
	 *
	 * @param primaryTerm - The primary die term to evaluate for explosion
	 */
	private async _evaluateViciousExplosion(primaryTerm: PrimaryDie): Promise<void> {
		const faces = primaryTerm.faces ?? 6;
		const maxIterations = 100; // Safety guard - even 100 consecutive max rolls is astronomically unlikely
		let iterations = 0;

		// Find the initial result (the base roll)
		const initialResult = primaryTerm.results.find((r) => r.active && !r.discarded);
		if (!initialResult) return;

		// Check if initial roll is a crit (max value)
		if (initialResult.result !== faces) return;

		// Mark initial result as exploded
		initialResult.exploded = true;

		// Roll vicious explosion dice
		let lastLeftResult = initialResult.result;

		while (lastLeftResult === faces && iterations < maxIterations) {
			iterations++;

			// Roll 2 dice together as a single roll event for Dice So Nice
			const explosionRoll = new Roll(`2d${faces}`);
			await explosionRoll.evaluate();

			// Extract results from the evaluated roll
			const dieTerm = explosionRoll.terms.find((t) => t instanceof Terms.Die) as
				| foundry.dice.terms.Die
				| undefined;
			if (!dieTerm || dieTerm.results.length < 2) break;

			const leftDie = dieTerm.results[0];
			const rightDie = dieTerm.results[1];

			// Add both to primary term results
			primaryTerm.results.push(leftDie);
			primaryTerm.results.push(rightDie);

			// Left die determines if we continue
			lastLeftResult = leftDie.result;

			// If left die also hit max, mark it as exploded and continue
			if (lastLeftResult === faces) {
				leftDie.exploded = true;
			}
		}

		// Update the formula to reflect the explosion
		this.resetFormula();
	}

	/**
	 * Recalculates the roll total after vicious explosion added dice.
	 */
	private _recalculateTotal(): void {
		const primaryTerm = this.terms.find((t) => t instanceof PrimaryDie);
		if (!primaryTerm) return;

		// Sum all active, non-discarded results from primary die
		const primaryTotal = primaryTerm.results
			.filter((r) => r.active && !r.discarded)
			.reduce((sum, r) => sum + r.result, 0);

		// Recalculate total from all terms
		let total = 0;
		for (const term of this.terms) {
			if (term instanceof PrimaryDie) {
				total += primaryTotal;
			} else if ('total' in term && typeof term.total === 'number') {
				total += term.total;
			}
		}

		const internals = this as object as { _total: number };
		internals._total = total;
	}

	/**
	 * Serializes the roll to a JSON-compatible object for storage or transmission.
	 *
	 * Includes all DamageRoll-specific properties: originalFormula, isMiss, and isCritical.
	 *
	 * @returns The serialized roll data.
	 */
	override toJSON() {
		return {
			...super.toJSON(),
			data: this.data,
			originalFormula: this.originalFormula,
			isMiss: this.isMiss,
			isCritical: this.isCritical,
			excludedPrimaryDieValue: this.excludedPrimaryDieValue,
		};
	}

	/** ------------------------------------------------------ */
	/**                    Static Methods                      */
	/** ------------------------------------------------------ */

	/**
	 * Type guard to check if terms array contains RollTerm instances.
	 *
	 * @param terms - The terms array to check.
	 * @returns True if all items in the array are RollTerm instances.
	 */
	private static _isRollTermArray(
		terms: DamageRoll.SerializedData['terms'],
	): terms is foundry.dice.terms.RollTerm[] {
		return Array.isArray(terms) && terms.every((t) => t instanceof foundry.dice.terms.RollTerm);
	}

	/**
	 * Sets the internal evaluated state of a roll.
	 *
	 * @param roll - The DamageRoll to mark as evaluated.
	 * @param total - The total value to set.
	 */
	private static _setEvaluatedState(roll: DamageRoll, total: number): void {
		const internals = roll as object as { _evaluated: boolean; _total: number };
		internals._evaluated = true;
		internals._total = total;
	}

	/**
	 * Creates a base Roll from serialized data for reconstruction.
	 *
	 * @param data - The serialized roll data.
	 * @returns A base Roll instance with reconstructed terms.
	 */
	private static _baseRollFromSerializedData(data: DamageRoll.SerializedData): Roll<AnyObject> {
		// Temporarily remove the class property to avoid infinite recursion
		// when calling the parent's fromData method
		const dataWithoutClass = { ...data };
		delete dataWithoutClass.class;

		// Foundry's Roll.fromData is typed as `Roll.Data`, but at runtime it accepts the broader
		// serialized shapes we store (including reconstructed term instances).
		return foundry.dice.Roll.fromData(dataWithoutClass as object as foundry.dice.Roll.Data);
	}

	/**
	 * Converts a standard Foundry Roll into a DamageRoll instance.
	 *
	 * @param roll - The Roll instance to convert.
	 * @returns A new DamageRoll with the same formula, data, options, and evaluated state.
	 */
	static fromRoll(roll) {
		const newRoll = new DamageRoll(roll.formula, roll.data, roll.options);
		Object.assign(newRoll, roll);
		return newRoll;
	}

	/**
	 * Reconstructs a DamageRoll from serialized data.
	 *
	 * This method properly restores all DamageRoll-specific state including:
	 * - The primary die term
	 * - Critical and miss status
	 * - Original formula
	 * - Evaluated state
	 *
	 * @template T - The Roll constructor type.
	 * @param data - The serialized roll data from `toJSON()`.
	 * @returns A fully reconstructed DamageRoll instance.
	 */
	static override fromData<T extends foundry.dice.Roll.AnyConstructor>(
		this: T,
		data: DamageRoll.SerializedData,
	): FixedInstanceType<T> {
		const baseRoll = DamageRoll._baseRollFromSerializedData(data);

		// Create a new DamageRoll instance
		// Use originalFormula if available, otherwise fall back to formula
		const formula = data.originalFormula ?? data.formula ?? baseRoll.formula;
		const options = (data.options ?? baseRoll.options) as DamageRoll.Options;
		const damageData = data.data ?? {};

		const roll = new DamageRoll(formula, damageData, options);

		if (baseRoll.terms && baseRoll.terms.length > 0) {
			// Restore terms from baseRoll (which has properly reconstructed term instances)
			// or from data if baseRoll doesn't have terms
			// This overwrites what the constructor did, which is important because
			// the constructor runs preprocessing that modifies terms
			roll.terms = baseRoll.terms;
		} else if (DamageRoll._isRollTermArray(data.terms)) {
			roll.terms = data.terms;
		}

		// Restore evaluated state using public methods
		const baseRollTotal = baseRoll.total;
		if (data.evaluated || baseRollTotal !== undefined) {
			const damageTotal = data.total ?? data._total ?? baseRollTotal ?? 0;
			DamageRoll._setEvaluatedState(roll, damageTotal);
		}

		// Restore custom properties
		roll.originalFormula = data.originalFormula ?? formula;
		roll._formula = data._formula ?? DamageRoll.getFormula(roll.terms);

		if (data.evaluated ?? true) {
			const opts = data.options;
			const optCritical =
				typeof opts === 'object' && opts !== null && typeof opts.isCritical === 'boolean'
					? opts.isCritical
					: undefined;
			const optMiss =
				typeof opts === 'object' && opts !== null && typeof opts.isMiss === 'boolean'
					? opts.isMiss
					: undefined;
			roll.isCritical = data.isCritical ?? optCritical;
			roll.isMiss = data.isMiss ?? optMiss;
		}

		if (roll.terms) {
			// Restore primaryDie if it exists in terms
			const primaryTerm = roll.terms.find((t) => t instanceof PrimaryDie);
			if (primaryTerm) {
				roll.primaryDie = primaryTerm;
			}
		}

		// Restore excludedPrimaryDieValue if it was serialized
		roll.excludedPrimaryDieValue = data.excludedPrimaryDieValue ?? 0;

		return roll as FixedInstanceType<T>;
	}
}

export { DamageRoll };
