import type { AnyObject, FixedInstanceType } from 'fvtt-types/utils';
import type { InexactPartial } from '#types/utils.js';

import { PrimaryDie } from './terms/PrimaryDie.js';

const Terms = foundry.dice.terms;

/**
 * Type definitions for DamageRoll.
 */
declare namespace DamageRoll {
	/**
	 * Roll data used for variable substitution in formulas.
	 * Can contain actor stats, item properties, or other numeric/string values.
	 */
	interface Data extends Record<string, number | string | boolean | object | null> {}

	/**
	 * Configuration options for damage rolls.
	 */
	interface Options extends foundry.dice.Roll.Options {
		/** Whether this roll can score a critical hit (rolling max on primary die) */
		canCrit: boolean;
		/** Whether this roll can miss (rolling 1 on primary die) */
		canMiss: boolean;
		/** The value at or above which a roll is considered critical (default: max faces) */
		criticalThreshold?: number;
		/** Number of bonus dice to add on critical hits (e.g., from Vicious weapons) */
		critBonusDice?: number;
		/** The type of damage dealt (e.g., "fire", "slashing") */
		damageType?: string;
		/** The value at or below which a roll is considered a fumble/miss (default: 1) */
		fumbleThreshold?: number;
		/** Roll mode: 0 = normal, positive = advantage (keep highest), negative = disadvantage (keep lowest) */
		rollMode: number;
		/** Force the primary die to show this specific value (for testing or special abilities) */
		primaryDieValue: number;
		/** Add this modifier to the primary die result */
		primaryDieModifier: number;
		/** When true, use DSN screen position to select primary die instead of kh/kl */
		usePositionSelection?: boolean;
	}

	/**
	 * Serialized format for storing/transmitting DamageRoll data.
	 * Used by toJSON() and fromData() for persistence.
	 */
	interface SerializedData {
		/** The dice formula string (e.g., "1d6+2") */
		formula: string;
		/** Serialized dice terms */
		terms?: foundry.dice.Roll.Data['terms'] | foundry.dice.terms.RollTerm[] | object[];
		/** Individual dice results */
		results?: Array<number | string>;
		/** The calculated total of the roll */
		total?: number | null;
		/** The class name for reconstruction */
		class?: string;
		/** Roll data for variable substitution */
		data?: Data;
		/** Roll options */
		options?:
			| (Partial<Options> & { isCritical?: boolean; isMiss?: boolean })
			| Record<string, boolean | number | string | null | undefined>
			| null;
		/** The original formula before preprocessing */
		originalFormula?: string;
		/** Whether the roll has been evaluated */
		evaluated?: boolean;
		/** Whether the roll was a critical hit */
		isCritical?: boolean;
		/** Whether the roll was a miss */
		isMiss?: boolean;
		/** Results from Vicious/crit bonus dice */
		critBonusResults?: number[];
		/** Internal total value */
		_total?: number;
		/** Internal formula string */
		_formula?: string;
	}

	/**
	 * Type representing an evaluated DamageRoll with guaranteed total.
	 * @template T - The DamageRoll type being evaluated
	 */
	type Evaluated<T extends DamageRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};

	/**
	 * Internal configuration for primary die processing.
	 * Used by _preProcessFormula helper methods.
	 */
	interface PrimaryDieConfig {
		/** Roll mode: 0 = normal, positive = advantage, negative = disadvantage */
		rollMode: number;
		/** Whether the die should explode on max roll (crit) */
		shouldExplode: boolean;
		/** Whether Vicious dice are present (affects explosion handling) */
		hasViciousDice: boolean;
		/** Whether to use position-based selection instead of kh/kl */
		usePositionSelection: boolean;
		/** Force the die to show this specific value */
		primaryDieValue?: number;
		/** Add this modifier to the die result */
		primaryDieModifier?: number;
	}
}

/**
 * Custom Roll class for damage calculations in Nimble.
 *
 * DamageRoll extends Foundry's Roll class to provide:
 * - Critical hit detection (rolling max on the primary die triggers explosions)
 * - Miss detection (rolling 1 on the primary die)
 * - Advantage/disadvantage support (rolling multiple dice and keeping highest/lowest)
 * - Vicious weapon support (bonus dice that roll alongside explosion dice)
 * - Proper serialization for chat message persistence
 *
 * The "primary die" is the first die term in the formula, which determines
 * hit/crit/miss status. Other dice in the formula are "damage dice" that
 * simply add to the total.
 *
 * @example
 * ```typescript
 * // Basic damage roll
 * const roll = new DamageRoll('1d6+2', actorData, { canCrit: true, canMiss: true });
 * await roll.evaluate();
 *
 * // With advantage
 * const advRoll = new DamageRoll('1d6+2', actorData, { rollMode: 1 }); // Rolls 2d6kh
 *
 * // With Vicious weapon (1 bonus die on crit)
 * const viciousRoll = new DamageRoll('1d6', actorData, { critBonusDice: 1 });
 * ```
 */
class DamageRoll extends foundry.dice.Roll<DamageRoll.Data> {
	declare options: DamageRoll.Options;

	/**
	 * Whether the roll resulted in a critical hit.
	 * Set after evaluation if the primary die rolled its maximum value.
	 * Will be `false` if `canCrit` option is false, `undefined` if not yet evaluated.
	 */
	isCritical: undefined | boolean = undefined;

	/**
	 * Whether the roll resulted in a miss.
	 * Set after evaluation if the primary die rolled a 1.
	 * Will be `false` if `canMiss` option is false, `undefined` if not yet evaluated.
	 */
	isMiss: undefined | boolean = undefined;

	/**
	 * The original formula before any preprocessing (advantage/disadvantage modifiers).
	 * Preserved for display purposes and serialization.
	 */
	originalFormula: string;

	/**
	 * Reference to the primary die term that determines crit/miss status.
	 * This is the first die in the formula, extracted and wrapped in a PrimaryDie instance.
	 */
	primaryDie: PrimaryDie | undefined = undefined;

	/**
	 * The processed formula string after preprocessing.
	 * May differ from originalFormula due to advantage/disadvantage modifications.
	 */
	override _formula: string = '';

	/**
	 * Results from Vicious/crit bonus dice rolled during explosions.
	 * Stored separately for display in effect nodes and chat tooltips.
	 * Each number represents the result of one Vicious die.
	 */
	critBonusResults: number[] = [];

	/**
	 * Creates a new DamageRoll instance.
	 * @param formula - The dice formula (e.g., "1d6+2", "2d8+@str.mod")
	 * @param data - Roll data for variable substitution in the formula
	 * @param options - Configuration options for crit/miss behavior, roll mode, etc.
	 */
	constructor(formula: string, data: DamageRoll.Data = {}, options?: DamageRoll.Options) {
		super(formula, data, options);

		console.log(
			'[DamageRoll] Constructor called',
			JSON.stringify({
				formula,
				data,
				options,
			}),
		);

		// Setup Defaults
		this.options.canCrit ??= true;
		this.options.canMiss ??= true;
		this.options.rollMode ??= 0;
		this.originalFormula = formula;
		this._formula = formula;

		if (!this.options.canCrit) this.isCritical = false;
		if (!this.options.canMiss) this.isMiss = false;

		console.log(
			'[DamageRoll] Constructor defaults applied',
			JSON.stringify({
				canCrit: this.options.canCrit,
				canMiss: this.options.canMiss,
				rollMode: this.options.rollMode,
				critBonusDice: this.options.critBonusDice,
				isCritical: this.isCritical,
				isMiss: this.isMiss,
			}),
		);

		this._preProcessFormula(
			formula,
			this.data ?? ({} as DamageRoll.Data),
			(this.options ?? {}) as DamageRoll.Options,
		);

		console.log(
			'[DamageRoll] Constructor complete',
			JSON.stringify({
				finalFormula: this._formula,
				primaryDie: this.primaryDie
					? {
							faces: this.primaryDie.faces,
							number: this.primaryDie.number,
							modifiers: this.primaryDie.modifiers,
							results: this.primaryDie.results,
						}
					: null,
				termsCount: this.terms.length,
			}),
		);
	}

	/**
	 * Applies roll mode modifiers (kh/kl) to a primary die.
	 * kh = keep highest (advantage), kl = keep lowest (disadvantage)
	 *
	 * @param primaryTerm - The PrimaryDie to modify
	 * @param config - Configuration including rollMode and position selection flag
	 */
	private _applyRollModeModifiers(
		primaryTerm: PrimaryDie,
		config: DamageRoll.PrimaryDieConfig,
	): void {
		const { rollMode, usePositionSelection } = config;

		// Skip kh/kl if using position-based selection - die is selected after DSN animation
		if (usePositionSelection) return;

		if (rollMode > 0) {
			primaryTerm.modifiers.push('kh');
		} else if (rollMode < 0) {
			primaryTerm.modifiers.push('kl');
		}
	}

	/**
	 * Applies explosion modifier to a primary die for critical hits.
	 * Skipped when Vicious dice are present (explosions handled in _evaluateExplosionWavesWithVicious).
	 *
	 * @param primaryTerm - The PrimaryDie to modify
	 * @param config - Configuration including shouldExplode and hasViciousDice flags
	 */
	private _applyExplosionModifier(
		primaryTerm: PrimaryDie,
		config: DamageRoll.PrimaryDieConfig,
	): void {
		const { shouldExplode, hasViciousDice } = config;

		// Only add explosion if crit is possible and no Vicious dice
		// Vicious dice require custom explosion handling for proper DSN animation
		if (shouldExplode && !hasViciousDice) {
			primaryTerm.modifiers.push('x');
		}
	}

	/**
	 * Applies a forced die value to a primary die (for testing or special abilities).
	 *
	 * @param primaryTerm - The PrimaryDie to modify
	 * @param forcedValue - The value to force the die to show
	 */
	private _applyForcedDieValue(primaryTerm: PrimaryDie, forcedValue: number): void {
		primaryTerm.results = [{ result: forcedValue, active: true }];
	}

	/**
	 * Applies a die modifier to a primary die, handling overflow as excess damage.
	 * If the modified result exceeds the die's maximum, the excess is added as a numeric term.
	 *
	 * @param primaryTerm - The PrimaryDie to modify
	 * @param modifier - The value to add to the die result
	 * @param faces - The number of faces on the die (maximum value)
	 */
	private _applyDieModifier(primaryTerm: PrimaryDie, modifier: number, faces: number): void {
		const baseResult = Math.ceil(Math.random() * faces);
		const modifiedResult = baseResult + modifier;

		if (modifiedResult > faces) {
			// Cap at max value, add excess as separate numeric term
			primaryTerm.results = [{ result: faces, active: true }];
			const excess = modifiedResult - faces;
			const excessTerm = new Terms.NumericTerm({ number: excess });
			const operatorTerm = new Terms.OperatorTerm({ operator: '+' });
			this.terms.splice(this.terms.indexOf(primaryTerm) + 1, 0, operatorTerm, excessTerm);
		} else {
			primaryTerm.results = [{ result: modifiedResult, active: true }];
		}
	}

	/**
	 * Configures a primary die with all necessary modifiers and values.
	 * Centralizes the common logic for both single-die and multi-die formulas.
	 *
	 * @param primaryTerm - The PrimaryDie to configure
	 * @param faces - The number of faces on the die
	 * @param config - Configuration for modifiers and forced values
	 */
	private _configurePrimaryDie(
		primaryTerm: PrimaryDie,
		faces: number,
		config: DamageRoll.PrimaryDieConfig,
	): void {
		// Apply modifiers in order: roll mode (kh/kl), then explosion
		this._applyRollModeModifiers(primaryTerm, config);
		this._applyExplosionModifier(primaryTerm, config);

		// Apply forced die value if specified
		if (config.primaryDieValue) {
			this._applyForcedDieValue(primaryTerm, config.primaryDieValue);
		}

		// Apply die modifier if specified (mutually exclusive with forced value in practice)
		if (config.primaryDieModifier && faces) {
			this._applyDieModifier(primaryTerm, config.primaryDieModifier, faces);
		}
	}

	/**
	 * Pre-processes the formula to extract and configure the primary die.
	 *
	 * This method:
	 * 1. Finds the first die term in the formula
	 * 2. Wraps it in a PrimaryDie instance for crit/miss detection
	 * 3. Applies roll mode modifiers (advantage adds "kh", disadvantage adds "kl")
	 * 4. Adds explosion modifier ("x") for critical hits (unless Vicious dice are present)
	 * 5. Handles forced die values and modifiers for special abilities
	 *
	 * When Vicious dice are present (critBonusDice > 0), the explosion modifier is NOT added
	 * because explosions are handled manually in _preRollExplosionsWithVicious to ensure
	 * Vicious dice roll together with explosion dice.
	 *
	 * @param _formula - The original dice formula (unused, kept for signature compatibility)
	 * @param _data - Roll data for variable substitution (unused, kept for signature compatibility)
	 * @param options - Roll options including canCrit, canMiss, rollMode, and primaryDieValue/Modifier
	 */
	_preProcessFormula(_formula: string, _data: DamageRoll.Data, options: DamageRoll.Options) {
		console.log(
			'[DamageRoll] _preProcessFormula called',
			JSON.stringify({
				formula: _formula,
				canCrit: options.canCrit,
				canMiss: options.canMiss,
				rollMode: options.rollMode,
				critBonusDice: options.critBonusDice,
				primaryDieValue: options.primaryDieValue,
				primaryDieModifier: options.primaryDieModifier,
				termsCount: this.terms.length,
			}),
		);

		// Only process if crit or miss detection is needed
		if (!(options.canCrit || options.canMiss)) {
			console.log('[DamageRoll] _preProcessFormula skipped (canCrit and canMiss both false)');
			return;
		}

		const firstDieTerm = this.terms.find((term) => term instanceof Terms.Die);
		if (!firstDieTerm) return;

		const { number = 1, faces = 6 } = firstDieTerm;
		const rollMode = options.rollMode ?? 0;

		// Build configuration for primary die processing
		const config: DamageRoll.PrimaryDieConfig = {
			rollMode,
			shouldExplode: options.canCrit ?? false,
			hasViciousDice: (options.critBonusDice ?? 0) > 0,
			usePositionSelection: (options.usePositionSelection ?? false) && rollMode !== 0,
			primaryDieValue: options.primaryDieValue,
			primaryDieModifier: options.primaryDieModifier,
		};

		console.log(
			'[DamageRoll] _preProcessFormula processing',
			JSON.stringify({
				rollMode: config.rollMode,
				shouldExplode: config.shouldExplode,
				hasViciousDice: config.hasViciousDice,
				usePositionSelection: config.usePositionSelection,
				firstDieTermFound: true,
				firstDieTermFaces: faces,
				firstDieTermNumber: number,
			}),
		);

		let primaryTerm: PrimaryDie;

		if (number > 1) {
			// Multi-die formula: Split off one die to become the primary
			primaryTerm = this._createPrimaryDieFromMultiDie(firstDieTerm, rollMode, faces);
		} else {
			// Single-die formula: Replace the die with a primary die
			primaryTerm = this._createPrimaryDieFromSingleDie(firstDieTerm, rollMode, faces);
		}

		// Apply all modifiers and configurations
		this._configurePrimaryDie(primaryTerm, faces, config);

		this.primaryDie = primaryTerm;

		console.log(
			'[DamageRoll] _preProcessFormula primaryDie created',
			JSON.stringify({
				faces: primaryTerm.faces,
				number: primaryTerm.number,
				modifiers: primaryTerm.modifiers,
				results: primaryTerm.results,
			}),
		);

		// Update formula to reflect term changes
		this.resetFormula();

		console.log(
			'[DamageRoll] _preProcessFormula complete',
			JSON.stringify({
				newFormula: this._formula,
				termsCount: this.terms.length,
			}),
		);
	}

	/**
	 * Creates a primary die from a multi-die formula (e.g., 2d6 -> 1d6 + PrimaryDie).
	 * Reduces the original die count by 1 and creates a new PrimaryDie for the split die.
	 *
	 * @param firstDieTerm - The original die term to split
	 * @param rollMode - Roll mode for advantage/disadvantage
	 * @param faces - Number of faces on the die
	 * @returns The created PrimaryDie
	 */
	private _createPrimaryDieFromMultiDie(
		firstDieTerm: foundry.dice.terms.Die,
		rollMode: number,
		faces: number,
	): PrimaryDie {
		// Reduce original term by one die
		firstDieTerm.number = (firstDieTerm.number ?? 1) - 1;

		// Add operator before primary term
		const operatorTerm = new Terms.OperatorTerm({ operator: '+' });
		this.terms.unshift(operatorTerm);

		// Create primary die (1 base + additional for advantage/disadvantage)
		const primaryTerm = new PrimaryDie({
			number: 1 + Math.abs(rollMode),
			faces,
			modifiers: [],
			options: { flavor: 'Primary Die' },
		});

		// Insert at beginning of terms
		this.terms.unshift(primaryTerm);

		return primaryTerm;
	}

	/**
	 * Creates a primary die from a single-die formula (e.g., 1d6 -> PrimaryDie).
	 * Replaces the original die with a PrimaryDie.
	 *
	 * @param firstDieTerm - The original die term to replace
	 * @param rollMode - Roll mode for advantage/disadvantage
	 * @param faces - Number of faces on the die
	 * @returns The created PrimaryDie
	 */
	private _createPrimaryDieFromSingleDie(
		_firstDieTerm: foundry.dice.terms.Die,
		rollMode: number,
		faces: number,
	): PrimaryDie {
		// Create primary die (1 base + additional for advantage/disadvantage)
		const primaryTerm = new PrimaryDie({
			number: 1 + Math.abs(rollMode),
			faces,
			modifiers: [],
			options: { flavor: 'Primary Die' },
		});

		// Replace original die term
		const idx = this.terms.findIndex((term) => term instanceof Terms.Die);
		if (idx !== -1) {
			this.terms[idx] = primaryTerm;
		}

		return primaryTerm;
	}

	/**
	 * Updates the primary die's face count (e.g., changing from d6 to d8).
	 *
	 * This is used when the die size needs to change after roll creation,
	 * such as when an actor's hit die changes or a special ability modifies
	 * the damage die.
	 *
	 * @param dieSize - The new number of faces for the primary die (e.g., 8 for d8)
	 */
	updatePrimaryTerm(dieSize: number) {
		console.log(
			'[DamageRoll] updatePrimaryTerm called',
			JSON.stringify({
				newDieSize: dieSize,
				currentPrimaryDie: this.primaryDie
					? {
							faces: this.primaryDie.faces,
							number: this.primaryDie.number,
						}
					: null,
			}),
		);

		if (!this.primaryDie) {
			console.log('[DamageRoll] updatePrimaryTerm aborted - no primaryDie');
			return;
		}

		const primaryTerm = this.terms.find((term) => term instanceof PrimaryDie);
		if (!primaryTerm) {
			console.log('[DamageRoll] updatePrimaryTerm error - no PrimaryDie in terms');
			ui.notifications?.error(`No primary die term found in roll ${this.formula}`);
			return;
		}

		primaryTerm.faces = dieSize;
		this.primaryDie = primaryTerm;
		this.resetFormula();

		console.log(
			'[DamageRoll] updatePrimaryTerm complete',
			JSON.stringify({
				newFormula: this._formula,
				primaryDieFaces: this.primaryDie.faces,
			}),
		);
	}

	/**
	 * Evaluates the damage roll, handling Vicious dice for proper Dice So Nice animation.
	 *
	 * When Vicious dice are present (critBonusDice > 0), we need special handling to ensure
	 * that explosion dice and Vicious dice roll TOGETHER in the same Dice So Nice animation.
	 *
	 * The evaluation flow for Vicious rolls:
	 * 1. Evaluate the primary die first (via super._evaluate on just that term)
	 * 2. If it crits, create a new Die term with (1 + viciousCount) dice for the explosion wave
	 * 3. Evaluate that new term - DSN animates all dice in that wave together
	 * 4. Check if the "explosion die" (randomly selected from the wave) crits
	 * 5. If so, repeat from step 2 until chain ends
	 * 6. Evaluate remaining terms (static modifiers, etc.)
	 *
	 * For non-Vicious rolls, we use the standard Foundry 'x' modifier behavior.
	 *
	 * @param options - Foundry roll evaluation options (async, minimize, maximize)
	 * @returns The evaluated damage roll with crit/miss status determined
	 */
	override async _evaluate(
		options?: InexactPartial<foundry.dice.Roll.Options>,
	): Promise<DamageRoll.Evaluated<this>> {
		console.log(
			'[DamageRoll] _evaluate called',
			JSON.stringify({
				formula: this._formula,
				evaluateOptions: options,
				canCrit: this.options.canCrit,
				canMiss: this.options.canMiss,
				critBonusDice: this.options.critBonusDice,
			}),
		);

		const primaryTerm = this.terms.find((term) => term instanceof PrimaryDie);
		const critBonusDice = this.options.critBonusDice ?? 0;

		console.log(
			'[DamageRoll] _evaluate primaryTerm state',
			JSON.stringify({
				primaryTermFound: !!primaryTerm,
				critBonusDice,
				primaryTermResultsLength: primaryTerm?.results.length ?? 0,
				primaryTermFaces: primaryTerm?.faces,
			}),
		);

		// When Vicious dice are present, use wave-based evaluation for proper DSN animation
		if (
			primaryTerm &&
			critBonusDice > 0 &&
			this.options.canCrit &&
			primaryTerm.results.length === 0
		) {
			console.log('[DamageRoll] _evaluate entering Vicious dice wave-based evaluation path');

			// Evaluate the primary die first
			await primaryTerm.evaluate();

			const faces = primaryTerm.faces ?? 6;
			// Check for Dice So Nice module
			const isDiceSoNice = game.modules.get('dice-so-nice')?.active;
			if (isDiceSoNice) {
				console.log(
					'[DamageRoll] _evaluate Dice So Nice module detected',
					JSON.stringify(primaryTerm),
				);
			}
			const primaryResult = primaryTerm.results[0]?.result ?? 0;
			const isCrit = primaryResult === faces;

			console.log(
				'[DamageRoll] _evaluate primary die evaluated',
				JSON.stringify({
					faces,
					primaryResult,
					isCrit,
				}),
			);

			if (isCrit) {
				// Mark the initial result as exploded
				if (primaryTerm.results[0]) {
					primaryTerm.results[0].exploded = true;
				}

				// Roll explosion waves with Vicious dice
				await this._evaluateExplosionWavesWithVicious(primaryTerm, critBonusDice, options);
			}

			console.log(
				'[DamageRoll] _evaluate after Vicious wave evaluation',
				JSON.stringify({
					primaryTermResultsCount: primaryTerm.results.length,
					primaryTermResults: primaryTerm.results,
					critBonusResults: this.critBonusResults,
				}),
			);

			// Now evaluate remaining terms (operators, numeric terms, etc.)
			// Skip already-evaluated terms
			for (const term of this.terms) {
				if (term === primaryTerm) continue;
				if (!(term as { _evaluated?: boolean })._evaluated) {
					await term.evaluate();
				}
			}

			// Compute total manually since we evaluated terms individually
			this._total = this.terms.reduce((total, term) => {
				if (term instanceof foundry.dice.terms.OperatorTerm) {
					return total; // Operators don't contribute directly
				}
				const prevTerm = this.terms[this.terms.indexOf(term) - 1];
				const operator =
					prevTerm instanceof foundry.dice.terms.OperatorTerm ? prevTerm.operator : '+';
				const termTotal = term.total ?? 0;

				if (operator === '+') return total + termTotal;
				if (operator === '-') return total - termTotal;
				if (operator === '*') return total * termTotal;
				if (operator === '/') return termTotal !== 0 ? total / termTotal : total;
				return total + termTotal;
			}, 0);

			(this as unknown as { _evaluated: boolean })._evaluated = true;
		} else {
			console.log('[DamageRoll] _evaluate calling super._evaluate()');

			// Standard evaluation path (no Vicious dice, or canCrit is false)
			await super._evaluate(options);
		}

		console.log(
			'[DamageRoll] _evaluate super._evaluate() complete',
			JSON.stringify({
				total: this.total,
				termsCount: this.terms.length,
			}),
		);

		// Post-evaluation: determine crit/miss status
		if (primaryTerm) {
			console.log(
				'[DamageRoll] _evaluate determining crit/miss status',
				JSON.stringify({
					critBonusDice,
					canCrit: this.options.canCrit,
					canMiss: this.options.canMiss,
					primaryTermResults: primaryTerm.results,
					primaryTermExploded: primaryTerm.exploded,
					primaryTermIsMiss: primaryTerm.isMiss,
				}),
			);

			if (critBonusDice > 0 && this.options.canCrit) {
				// We determined crit status during wave evaluation
				this.isCritical = primaryTerm.results.some((r) => r.exploded && r.active && !r.discarded);
			} else {
				// Standard behavior - Foundry's 'x' modifier handled explosions
				if (this.options.canCrit) this.isCritical = primaryTerm.exploded;
			}

			if (this.options.canMiss) this.isMiss = primaryTerm.isMiss;
		}

		console.log(
			'[DamageRoll] _evaluate complete',
			JSON.stringify({
				total: this.total,
				isCritical: this.isCritical,
				isMiss: this.isMiss,
				critBonusResults: this.critBonusResults,
				primaryDieResults: primaryTerm ? primaryTerm.results : null,
			}),
		);

		return this as DamageRoll.Evaluated<this>;
	}

	/**
	 * Evaluates explosion waves with Vicious dice, creating actual Die terms for DSN animation.
	 *
	 * Each explosion wave creates a new Die term with (1 + viciousCount) dice. This term is
	 * evaluated through Foundry's normal dice system, so Dice So Nice will animate all dice
	 * in the wave TOGETHER in a single throw.
	 *
	 * After evaluation, one die from each wave is randomly designated as the "explosion die"
	 * which determines if the chain continues. The remaining dice are "Vicious dice" and
	 * their results are stored in critBonusResults for display.
	 *
	 * @param primaryTerm - The primary die term to add explosion results to
	 * @param viciousCount - Number of Vicious bonus dice to add per explosion wave
	 * @param options - Roll evaluation options
	 */
	private async _evaluateExplosionWavesWithVicious(
		primaryTerm: PrimaryDie,
		viciousCount: number,
		options?: InexactPartial<foundry.dice.Roll.Options>,
	): Promise<void> {
		console.log(
			'[DamageRoll] _evaluateExplosionWavesWithVicious called',
			JSON.stringify({
				viciousCount,
				primaryTermFaces: primaryTerm.faces,
				primaryTermResultsBefore: primaryTerm.results,
			}),
		);

		const faces = primaryTerm.faces ?? 6;
		this.critBonusResults = [];

		// Total dice per explosion wave: 1 explosion die + viciousCount Vicious dice
		const dicePerWave = 1 + viciousCount;
		let waveNumber = 0;
		let continueChain = true;

		console.log(
			'[DamageRoll] _evaluateExplosionWavesWithVicious config',
			JSON.stringify({
				faces,
				dicePerWave,
			}),
		);

		while (continueChain) {
			waveNumber++;

			// Create a Roll for this wave - all dice roll together in DSN
			// Using a Roll (not just a Die term) ensures proper Foundry evaluation and DSN animation
			const waveFormula = `${dicePerWave}d${faces}`;
			// evaluate this...
			const waveRoll = new foundry.dice.Roll(waveFormula);

			// Evaluate the wave roll - DSN will animate all dice together
			await waveRoll.evaluate(options);

			// Get the Die term from the evaluated roll
			const waveTerm = waveRoll.terms.find((t) => t instanceof Terms.Die);
			if (!waveTerm || !waveTerm.results) {
				console.error('[DamageRoll] _evaluateExplosionWavesWithVicious: waveTerm not found');
				break;
			}

			// Randomly select which die is the "explosion die" (determines chain continuation)
			const explosionDieIndex = Math.floor(Math.random() * dicePerWave);
			const explosionDieResult = waveTerm.results[explosionDieIndex]?.result ?? 0;
			const doesExplode = explosionDieResult === faces;

			console.log(
				`[DamageRoll] _evaluateExplosionWavesWithVicious wave ${waveNumber}`,
				JSON.stringify({
					waveResults: waveTerm.results.map((r) => r.result),
					explosionDieIndex,
					explosionDieResult,
					willContinue: doesExplode,
				}),
			);

			// Add all wave results to the primary term
			for (let i = 0; i < waveTerm.results.length; i++) {
				const result = waveTerm.results[i];
				const isExplosionDie = i === explosionDieIndex;

				primaryTerm.results.push({
					result: result.result,
					active: true,
					exploded: isExplosionDie && doesExplode,
				});

				// Track Vicious dice results (all dice except the explosion die)
				if (!isExplosionDie) {
					this.critBonusResults.push(result.result);
				}
			}

			// Chain continues only if the explosion die rolled max
			continueChain = doesExplode;
		}

		console.log(
			'[DamageRoll] _evaluateExplosionWavesWithVicious complete',
			JSON.stringify({
				totalWaves: waveNumber,
				primaryTermResultsCount: primaryTerm.results.length,
				primaryTermResults: primaryTerm.results,
				critBonusResults: this.critBonusResults,
				critBonusTotal: this.critBonusResults.reduce((sum, r) => sum + r, 0),
			}),
		);
	}

	/**
	 * Applies position-based primary die selection using DSN dice positions.
	 *
	 * When rolling with advantage/disadvantage and position-based selection is enabled,
	 * this method is called after DSN animation completes to select the leftmost die
	 * as the "kept" die instead of using kh/kl by value.
	 *
	 * If no positions are provided (DSN not active), falls back to random selection.
	 *
	 * @param dicePositions - Array of dice with their screen x positions, sorted leftmost first
	 * @returns Object with updated isCritical, isMiss, and total values
	 */
	applyPositionBasedSelection(dicePositions: { result: number; index: number; x: number }[]): {
		isCritical: boolean;
		isMiss: boolean;
		total: number;
		selectedDieIndex: number;
		selectedDieResult: number;
	} {
		const primaryDie = this.primaryDie;
		if (!primaryDie) {
			return {
				isCritical: this.isCritical,
				isMiss: this.isMiss,
				total: this.total ?? 0,
				selectedDieIndex: 0,
				selectedDieResult: 0,
			};
		}

		// Use provided positions or fall back to random selection
		let positions = dicePositions;
		if (positions.length === 0) {
			const diceCount = primaryDie.results.length;
			const randomIndex = Math.floor(Math.random() * diceCount);
			const randomResult = primaryDie.results[randomIndex]?.result ?? 0;

			console.log(
				'[DamageRoll] applyPositionBasedSelection using random fallback',
				JSON.stringify({
					diceCount,
					randomIndex,
					randomResult,
				}),
			);

			// Create a synthetic position for the randomly selected die
			positions = [
				{
					result: randomResult,
					index: randomIndex,
					x: 0,
				},
			];
		}

		// The leftmost die (index 0 in sorted positions) is the selected primary
		const selectedPosition = positions[0];
		const selectedResult = selectedPosition.result;
		const faces = primaryDie.faces ?? 6;

		console.log(
			'[DamageRoll] applyPositionBasedSelection',
			JSON.stringify({
				dicePositions,
				selectedIndex: selectedPosition.index,
				selectedResult,
				faces,
				rollMode: this.options.rollMode,
			}),
		);

		// Update the primary die results - mark selected as active, others as discarded
		for (let i = 0; i < primaryDie.results.length; i++) {
			const result = primaryDie.results[i];
			// In DSN, dice are indexed in order they were added
			// The selected die is the one at the position index
			if (i === selectedPosition.index) {
				result.active = true;
				result.discarded = false;
			} else {
				result.active = false;
				result.discarded = true;
			}
		}

		// Determine crit/miss based on selected die
		const isCritical = this.options.canCrit && selectedResult === faces;
		const isMiss = this.options.canMiss && !isCritical && selectedResult === 1;

		// Update instance properties
		this.isCritical = isCritical;
		this.isMiss = isMiss;

		// Recalculate total (only the selected die contributes from the primary)
		// Note: This is simplified - full recalculation would need to handle all terms
		const _previousPrimaryTotal = primaryDie.results
			.filter((r) => r.active && !r.discarded)
			.reduce((sum, r) => sum + (r.result ?? 0), 0);

		// The total should use only the selected die's result from the primary dice
		// We need to recalculate based on all terms but with updated primary die
		this.resetFormula();

		return {
			isCritical,
			isMiss,
			total: this.total ?? 0,
			selectedDieIndex: selectedPosition.index,
			selectedDieResult: selectedResult,
		};
	}

	/**
	 * Checks if this roll is waiting for position-based selection.
	 *
	 * @returns True if the roll has position selection enabled and hasn't been finalized
	 */
	get needsPositionSelection(): boolean {
		return (
			this.options.usePositionSelection === true &&
			this.options.rollMode !== 0 &&
			this._evaluated === true
		);
	}

	/**
	 * Serializes the roll to JSON for storage in chat messages or other persistence.
	 *
	 * Extends the parent toJSON() to include DamageRoll-specific properties:
	 * - originalFormula: The formula before preprocessing
	 * - isCritical: Whether a crit was rolled
	 * - isMiss: Whether a miss was rolled
	 * - critBonusResults: Individual Vicious die results for tooltip display
	 *
	 * @returns Serialized roll data that can be restored with fromData()
	 */
	override toJSON() {
		const json = {
			...super.toJSON(),
			data: this.data,
			originalFormula: this.originalFormula,
			isMiss: this.isMiss,
			isCritical: this.isCritical,
			critBonusResults: this.critBonusResults,
		};

		console.log(
			'[DamageRoll] toJSON called',
			JSON.stringify({
				formula: this._formula,
				originalFormula: this.originalFormula,
				isCritical: this.isCritical,
				isMiss: this.isMiss,
				critBonusResults: this.critBonusResults,
				total: this.total,
			}),
		);

		return json;
	}

	/**
	 * Type guard to check if a terms array contains instantiated RollTerm objects.
	 *
	 * Used during deserialization to determine if terms have already been
	 * reconstructed into proper RollTerm instances or are still raw data objects.
	 *
	 * @param terms - The terms array to check (may be raw data or RollTerm instances)
	 * @returns True if all elements are RollTerm instances, false otherwise
	 */
	private static _isRollTermArray(
		terms: DamageRoll.SerializedData['terms'],
	): terms is foundry.dice.terms.RollTerm[] {
		return (
			Array.isArray(terms) && terms.every((term) => term instanceof foundry.dice.terms.RollTerm)
		);
	}

	/**
	 * Sets the internal evaluated state on a roll instance.
	 *
	 * Foundry's Roll class uses private properties (_evaluated, _total) to track
	 * evaluation state. This helper allows us to restore that state during
	 * deserialization without re-evaluating the roll.
	 *
	 * @param roll - The roll instance to mark as evaluated
	 * @param total - The total value to set on the roll
	 */
	private static _setEvaluatedState(roll: DamageRoll, total: number): void {
		const internals = roll as object as { _evaluated: boolean; _total: number };
		internals._evaluated = true;
		internals._total = total;
	}

	/**
	 * Creates a base Roll from serialized data without the class property.
	 *
	 * This helper reconstructs term instances from serialized data by leveraging
	 * Foundry's Roll.fromData(). The class property is temporarily removed to
	 * prevent Foundry from trying to instantiate a DamageRoll (which would cause
	 * infinite recursion).
	 *
	 * @param data - Serialized roll data from toJSON() or chat message storage
	 * @returns A base Roll instance with properly reconstructed terms
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
	 * Creates a DamageRoll from an existing Roll instance.
	 *
	 * This factory method allows converting a standard Foundry Roll into a DamageRoll,
	 * preserving all existing properties while gaining DamageRoll's crit/miss detection
	 * capabilities.
	 *
	 * @param roll - The source roll to convert (any Roll-like object with formula, data, options)
	 * @returns A new DamageRoll instance with properties copied from the source
	 */
	static fromRoll(roll) {
		console.log(
			'[DamageRoll] fromRoll called',
			JSON.stringify({
				sourceFormula: roll.formula,
				sourceIsCritical: roll.isCritical,
				sourceIsMiss: roll.isMiss,
			}),
		);

		const newRoll = new DamageRoll(roll.formula, roll.data, roll.options);
		Object.assign(newRoll, roll);

		console.log(
			'[DamageRoll] fromRoll complete',
			JSON.stringify({
				newRollFormula: newRoll._formula,
				newRollIsCritical: newRoll.isCritical,
				newRollIsMiss: newRoll.isMiss,
			}),
		);

		return newRoll;
	}

	/**
	 * Reconstructs a DamageRoll from serialized data (e.g., from a chat message).
	 *
	 * This static method is called by Foundry when loading rolls from the database
	 * or when reconstructing rolls from chat message data. It handles:
	 * - Reconstructing dice terms with proper class instances
	 * - Restoring evaluated state (_evaluated, _total)
	 * - Restoring DamageRoll-specific properties (isCritical, isMiss, critBonusResults)
	 * - Restoring the primaryDie reference
	 *
	 * @template T - The constructor type (for TypeScript compatibility with Foundry's typing)
	 * @param data - Serialized roll data from toJSON() or database storage
	 * @returns A fully reconstructed DamageRoll instance with all state restored
	 */
	static override fromData<T extends foundry.dice.Roll.AnyConstructor>(
		this: T,
		data: DamageRoll.SerializedData,
	): FixedInstanceType<T> {
		console.log(
			'[DamageRoll] fromData called',
			JSON.stringify({
				dataFormula: data.formula,
				dataOriginalFormula: data.originalFormula,
				dataIsCritical: data.isCritical,
				dataIsMiss: data.isMiss,
				dataCritBonusResults: data.critBonusResults,
				dataEvaluated: data.evaluated,
				dataTotal: data.total,
				dataTermsCount: data.terms?.length,
			}),
		);

		const baseRoll = DamageRoll._baseRollFromSerializedData(data);

		// Create a new DamageRoll instance
		// Use originalFormula if available, otherwise fall back to formula
		const formula = data.originalFormula ?? data.formula ?? baseRoll.formula;
		const options = (data.options ?? baseRoll.options) as DamageRoll.Options;
		const damageData = data.data ?? {};

		console.log(
			'[DamageRoll] fromData creating new DamageRoll',
			JSON.stringify({
				formula,
				baseRollFormula: baseRoll.formula,
				baseRollTotal: baseRoll.total,
				baseRollTermsCount: baseRoll.terms?.length,
			}),
		);

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
			roll.critBonusResults = data.critBonusResults ?? [];
		}

		if (roll.terms) {
			// Restore primaryDie if it exists in terms
			const primaryTerm = roll.terms.find((term) => term instanceof PrimaryDie);
			if (primaryTerm) {
				roll.primaryDie = primaryTerm;
			}
		}

		console.log(
			'[DamageRoll] fromData complete',
			JSON.stringify({
				rollFormula: roll._formula,
				rollOriginalFormula: roll.originalFormula,
				rollIsCritical: roll.isCritical,
				rollIsMiss: roll.isMiss,
				rollCritBonusResults: roll.critBonusResults,
				rollTotal: roll.total,
				rollTermsCount: roll.terms?.length,
				rollHasPrimaryDie: !!roll.primaryDie,
			}),
		);

		return roll as FixedInstanceType<T>;
	}
}

export { DamageRoll };
