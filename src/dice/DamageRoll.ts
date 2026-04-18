import type { AnyObject, FixedInstanceType } from 'fvtt-types/utils';
import type { InexactPartial } from '#types/utils.js';

import { getNimbleMods } from './nimbleDieModifiers.js';
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
		/**
		 * Optional list of advantage/disadvantage source contributions. If provided,
		 * the engine sums them to compute a net rollMode (Phase -1: source aggregation).
		 * Each entry is a signed integer: +1 per advantage source, -1 per disadvantage.
		 * The aggregated net is written to `netRollMode` and overrides `rollMode`.
		 */
		rollModeSources?: number[];
		/** Net rollMode after summing rollModeSources (computed; do not set manually). */
		netRollMode?: number;
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
		 * Explosion behavior for crit dice.
		 * - 'none'     — crit detected, no continuation dice rolled
		 * - 'standard' — Foundry's native `x` modifier chain
		 * - 'vicious'  — roll 2 dice on crit, left can chain
		 * Default: 'standard'
		 */
		explosionStyle?: 'none' | 'standard' | 'vicious';
		/**
		 * When true, the primary die is the highest-value result in the pool,
		 * not the leftmost. Driven by the Brutal monster trait (GM:1894).
		 * Set by ItemActivationManager from actor traits — not baked into formulas.
		 * Default: false
		 */
		brutalPrimary?: boolean;
		/**
		 * @deprecated Use `explosionStyle: 'vicious'` instead. Translated to
		 *   `explosionStyle` by the constructor shim for back-compat.
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
		critCount?: number;
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

	/** Number of crit-capable dice that rolled max. 0 until evaluated. */
	critCount: number = 0;

	/** The original formula before preprocessing (e.g., before primary die extraction). */
	originalFormula: string;

	/**
	 * The primary die term used for crit/miss detection and rules-level value reads.
	 *
	 * **Reading the primary die value (stable API):**
	 * ```typescript
	 * const value = roll.primaryDieValue;          // convenience getter
	 * const faces = roll.primaryDie?.faces;
	 * ```
	 *
	 * In legacy mode: a PrimaryDie instance (leftmost, extracted from formula).
	 * In modifier-mode: the leftmost Die tagged `c`/`cv`, or the highest-value
	 * die if `brutalPrimary` is active, falling back to leftmost Die overall.
	 */
	primaryDie: PrimaryDie | foundry.dice.terms.Die | undefined = undefined;

	/** The kept value of the primary die after evaluation. Undefined if unevaluated. */
	get primaryDieValue(): number | undefined {
		const die = this.primaryDie;
		if (!die) return undefined;
		if (this.options.brutalPrimary) {
			// Brutal: the "primary" value is the highest active non-discarded result
			let max = -1;
			for (const r of die.results) {
				if (r.active && !r.discarded && r.result > max) {
					max = r.result;
				}
			}
			return max >= 0 ? max : undefined;
		}
		return die.results.find((r) => r.active && !r.discarded)?.result;
	}

	/**
	 * Whether this roll uses per-die modifier dispatch (modifier-mode).
	 * True when the formula contains Nimble die modifiers (`c`, `cv`, `v`, `n`).
	 * When true, `_extractPrimaryDie` is skipped and crit/miss detection uses
	 * per-die metadata instead of PrimaryDie.
	 */
	modifierMode: boolean = false;

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

		// Aggregate multiple adv/dis sources into a single net rollMode.
		// Per Nimble rules, advantage and disadvantage cancel 1-for-1.
		// If callers supply rollModeSources, sum them to compute the net;
		// single-source callers keep using the scalar rollMode unchanged.
		if (Array.isArray(this.options.rollModeSources)) {
			const net = this.options.rollModeSources.reduce(
				(sum, n) => sum + (Number.isFinite(n) ? n : 0),
				0,
			);
			this.options.netRollMode = net;
			this.options.rollMode = net;
		} else {
			this.options.netRollMode = this.options.rollMode;
		}
		this.options.primaryDieAsDamage ??= true;

		// Normalize explosion style. Explicit explosionStyle wins over legacy isVicious.
		if (this.options.explosionStyle === undefined) {
			this.options.explosionStyle = this.options.isVicious ? 'vicious' : 'standard';
		}

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
	/**                Modifier-Mode Detection                */
	/** ------------------------------------------------------ */

	/** Nimble modifier tokens that trigger modifier-mode when present on any Die term. */
	private static readonly NIMBLE_MODIFIER_TOKENS = new Set(['c', 'cv', 'v', 'n']);

	/**
	 * Check whether any Die term in `this.terms` carries a Nimble modifier.
	 * If so, the roll enters modifier-mode and skips PrimaryDie extraction.
	 */
	private _hasNimbleModifiers(): boolean {
		for (const term of this.terms) {
			if (!(term instanceof Terms.Die)) continue;
			if (!Array.isArray(term.modifiers)) continue;
			for (const m of term.modifiers) {
				if (DamageRoll.NIMBLE_MODIFIER_TOKENS.has(m)) return true;
			}
		}
		return false;
	}

	/** ------------------------------------------------------ */
	/**                  Data Prep Helpers                     */
	/** ------------------------------------------------------ */

	/**
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

		// Use Nimble's custom keep-modifiers (`khn`/`kln`) which enforce
		// leftmost-on-tie discarding. Registered as Foundry Die modifiers
		// in `nimbleDieModifiers.ts` at system init.
		if (rollMode > 0) {
			dieTerm.modifiers.push(keep === 1 ? 'khn' : `khn${keep}`);
		} else {
			dieTerm.modifiers.push(keep === 1 ? 'kln' : `kln${keep}`);
		}
	}

	/**
	 * Extracts and configures a primary die from the first die term.
	 *
	 * The primary die is used for critical hit and miss detection. It is configured with:
	 * - Explosion modifier ('x') for critical detection if canCrit is true
	 * - Keep highest ('khn') or keep lowest ('kln') Nimble modifiers based on rollMode
	 *
	 * @param options - Roll options containing canCrit, canMiss, rollMode, and preset values.
	 */
	private _extractPrimaryDie(options: DamageRoll.Options): void {
		const { rollMode = 0 } = options;
		const explosionStyle = options.explosionStyle ?? 'standard';
		const isVicious = explosionStyle === 'vicious';
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
			if (shouldExplode && explosionStyle === 'standard') primaryTerm.modifiers.push('x');

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
			if (shouldExplode && explosionStyle === 'standard') primaryTerm.modifiers.push('x');

			this._applyPrimaryDiePresets(primaryTerm, options);

			const idx = this.terms.findIndex((t) => t instanceof Terms.Die);
			if (idx !== -1) this.terms[idx] = primaryTerm;
		}

		this.primaryDie = primaryTerm;
	}

	/**
	 * Apply primaryDieValue / primaryDieModifier presets to the primary die.
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
	 * Pre-processes the formula, partitioning it into a primary pool (PrimaryDie
	 * term) plus bonus dice when crit/miss detection is needed, or applying
	 * adv/dis directly to the first die term in the AoE fallback case.
	 *
	 * If the formula already contains Nimble die modifiers (`c`, `cv`, `v`, `n`),
	 * the roll enters modifier-mode: PrimaryDie extraction is skipped, and
	 * crit/miss detection is deferred to per-die dispatch in `_evaluate`.
	 *
	 * @param _formula - The original dice formula (unused, kept for signature compatibility).
	 * @param _data - Roll data (unused, kept for signature compatibility).
	 * @param options - Roll options containing canCrit, canMiss, and rollMode settings.
	 */
	_preProcessFormula(_formula: string, _data: DamageRoll.Data, options: DamageRoll.Options) {
		// ── Modifier-mode: formula already carries Nimble modifiers ──
		if (this._hasNimbleModifiers()) {
			this.modifierMode = true;
			// Apply rollMode (advantage/disadvantage) to the first die term
			// even in modifier-mode — it's orthogonal to crit/miss detection.
			const { rollMode = 0 } = options;
			if (rollMode) {
				const firstDieTerm = this.terms.find((t) => t instanceof Terms.Die);
				if (firstDieTerm) {
					this._applyRollMode(firstDieTerm, rollMode);
				}
			}
			this.resetFormula();
			return;
		}

		// ── Legacy path: no Nimble modifiers in formula ──
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
			// 2d8 with advantage → 3d8khn2
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

		this._applyPostRollMutations();

		if (this.modifierMode) {
			// ── Count crits BEFORE vicious explosions to avoid counting chain dice ──
			this.critCount = this._countModifierModeCrits();

			// ── Modifier-mode: per-die vicious explosion ──
			for (const term of this.terms) {
				if (!(term instanceof Terms.Die)) continue;
				const meta = getNimbleMods(term);
				if (meta?.canCrit && meta.explosionStyle === 'vicious') {
					await this._evaluateViciousExplosions(term);
				}
			}
			this._finalizeOutcomeModifierMode();
		} else {
			// ── Legacy path ──
			const primaryTerm = this.terms.find((t) => t instanceof PrimaryDie);
			if (primaryTerm) {
				if (this.options.canCrit && this.options.explosionStyle === 'vicious') {
					await this._evaluateViciousExplosion(primaryTerm);
				}
				this._finalizeOutcome(primaryTerm);
			}
		}

		return this as DamageRoll.Evaluated<this>;
	}

	/**
	 * Interpret primary die outcome after evaluation and adjust total for
	 * vicious recalculation and primaryDieAsDamage exclusion.
	 */
	private _finalizeOutcome(primaryTerm: PrimaryDie): void {
		const isVicious = this.options.explosionStyle === 'vicious';

		// Crit = a kept (active, non-discarded) result from the primary die
		// rolled max face value. Value-based (not flag-based) so that
		// explosionStyle: 'none' — which never sets the exploded flag —
		// still detects crit correctly.
		if (this.options.canCrit) {
			this.isCritical = primaryTerm.results.some(
				(r) => r.active && !r.discarded && r.result === primaryTerm.faces,
			);
		}
		this.critCount = this.isCritical ? 1 : 0;

		if (this.options.canMiss) this.isMiss = primaryTerm.isMiss;

		this._applyBrutalRemapping(
			this.terms.filter((t): t is foundry.dice.terms.Die => t instanceof Terms.Die),
		);

		// Recalculate total if vicious explosion added dice
		// This must happen BEFORE primaryDieAsDamage exclusion to avoid double-counting
		if (isVicious && this.isCritical) {
			this._recalculateTotal();
		}

		// When primaryDieAsDamage is false, exclude the base die value from damage
		// (explosions still count toward damage)
		if (!this.options.primaryDieAsDamage) {
			// Find the base roll. The base die is always at index 0 of
			// `results` (pushed before any vicious explosion dice — see
			// `_evaluateViciousExplosion`, which appends with `.push()`), and
			// for non-vicious crits Foundry's native `x` modifier likewise
			// keeps the original die at index 0. We therefore take the FIRST
			// active, non-discarded result rather than filtering on the
			// `exploded` flag — the base die itself is marked `exploded` by
			// the vicious path, so a flag-based filter would skip it.
			const baseResult = primaryTerm.results.find((r) => r.active && !r.discarded);
			if (baseResult) {
				this.excludedPrimaryDieValue = baseResult.result;
				// Adjust the total by subtracting the base die value
				const internals = this as object as { _total: number };
				internals._total = (this._total ?? 0) - this.excludedPrimaryDieValue;
			}
		}
	}

	/**
	 * Extension point for features that mutate primary die values after
	 * rolling but before outcome resolution (e.g. Hexbinder Doomed,
	 * Vicious Opportunist). Intentionally empty today.
	 */
	private _applyPostRollMutations(): void {
		// No-op. Reserved for future mutation features.
	}

	/**
	 * Manually resolves vicious crit explosion to avoid Dice So Nice preempting
	 * the rolls.
	 *
	 * Vicious explosion rules:
	 * 1. If initial die = max, roll 2 explosion dice
	 * 2. Left die can chain explode, right die cannot
	 * 3. If left die = max, roll 2 more dice
	 * 4. Continue until left die is NOT max
	 *
	 * @param dieTerm - The die term to evaluate for explosion
	 */
	private async _evaluateViciousExplosion(dieTerm: foundry.dice.terms.Die): Promise<void> {
		const faces = dieTerm.faces ?? 6;
		const maxIterations = 100; // Safety guard - even 100 consecutive max rolls is astronomically unlikely
		let iterations = 0;

		// Find the initial result (the base roll)
		const initialResult = dieTerm.results.find((r) => r.active && !r.discarded);
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
			const explosionDieTerm = explosionRoll.terms.find((t) => t instanceof Terms.Die) as
				| foundry.dice.terms.Die
				| undefined;
			if (!explosionDieTerm || explosionDieTerm.results.length < 2) break;

			const leftDie = explosionDieTerm.results[0] as foundry.dice.terms.DiceTerm.Result & {
				provenance?: string;
			};
			const rightDie = explosionDieTerm.results[1] as foundry.dice.terms.DiceTerm.Result & {
				provenance?: string;
			};

			// Tag provenance: left continues the explosion chain, right is the
			// extra die added by the vicious property. Visualizers (testbench,
			// chat card) can group / label each role.
			leftDie.provenance = 'viciousChain';
			rightDie.provenance = 'viciousBonus';

			// Add both to die term results
			dieTerm.results.push(leftDie);
			dieTerm.results.push(rightDie);

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
	 * Per-die vicious explosion for modifier-mode. Unlike `_evaluateViciousExplosion`
	 * which handles a single initial result, this method iterates ALL active,
	 * non-discarded results that rolled max in a multi-die term (e.g. 4d4cv where
	 * 2 of 4 dice crit) and fires a vicious explosion chain for each.
	 */
	private async _evaluateViciousExplosions(dieTerm: foundry.dice.terms.Die): Promise<void> {
		const faces = dieTerm.faces ?? 6;
		// Snapshot base results to avoid iterating over explosion dice we add
		const baseResults = [...dieTerm.results];

		for (const result of baseResults) {
			if (!result.active || result.discarded || result.result !== faces) continue;

			// Mark as exploded and chain
			result.exploded = true;
			let lastLeftResult = result.result;
			let iterations = 0;
			const maxIterations = 100;

			while (lastLeftResult === faces && iterations < maxIterations) {
				iterations++;
				const explosionRoll = new Roll(`2d${faces}`);
				await explosionRoll.evaluate();

				const explosionDieTerm = explosionRoll.terms.find((t) => t instanceof Terms.Die) as
					| foundry.dice.terms.Die
					| undefined;
				if (!explosionDieTerm || explosionDieTerm.results.length < 2) break;

				const leftDie = explosionDieTerm.results[0] as foundry.dice.terms.DiceTerm.Result & {
					provenance?: string;
				};
				const rightDie = explosionDieTerm.results[1] as foundry.dice.terms.DiceTerm.Result & {
					provenance?: string;
				};

				leftDie.provenance = 'viciousChain';
				rightDie.provenance = 'viciousBonus';
				dieTerm.results.push(leftDie);
				dieTerm.results.push(rightDie);

				lastLeftResult = leftDie.result;
				if (lastLeftResult === faces) leftDie.exploded = true;
			}
		}

		this.resetFormula();
	}

	/**
	 * When `brutalPrimary` is active, scan all Die terms and reassign
	 * `primaryDie` to the term containing the highest active non-discarded
	 * result. Ties: leftmost wins (strict `>`, not `>=`).
	 */
	private _applyBrutalRemapping(dieTerms: foundry.dice.terms.Die[]): void {
		if (!this.options.brutalPrimary) return;
		let highestValue = -1;
		let highestDie: foundry.dice.terms.Die | undefined;
		for (const term of dieTerms) {
			for (const r of term.results) {
				if (r.active && !r.discarded && r.result > highestValue) {
					highestValue = r.result;
					highestDie = term;
				}
			}
		}
		if (highestDie) this.primaryDie = highestDie;
	}

	/**
	 * Count crit-capable dice that rolled max BEFORE vicious explosions append
	 * chain dice to the results array. Called from `_evaluate` so that
	 * `critCount` reflects base crits only, not continuation dice.
	 */
	private _countModifierModeCrits(): number {
		let count = 0;
		for (const term of this.terms) {
			if (!(term instanceof Terms.Die)) continue;
			const meta = getNimbleMods(term);
			if (!meta?.canCrit) continue;
			for (const r of term.results) {
				if (r.active && !r.discarded && r.result === term.faces) {
					count++;
				}
			}
		}
		return count;
	}

	/**
	 * Modifier-mode outcome finalization. Replaces `_finalizeOutcome` when the
	 * roll uses per-die modifiers instead of a PrimaryDie term.
	 */
	private _finalizeOutcomeModifierMode(): void {
		const dieTerms = this.terms.filter((t): t is foundry.dice.terms.Die => t instanceof Terms.Die);

		// ── Crit detection: critCount was computed before vicious explosions in _evaluate ──
		if (this.options.canCrit) {
			this.isCritical = this.critCount > 0;
		}

		// ── Miss detection: leftmost non-neutral Die ──
		if (this.options.canMiss) {
			const missDie = dieTerms.find((term) => {
				const meta = getNimbleMods(term);
				// A die is "neutral" if tagged `n` (canCrit:false, explosionStyle:'none')
				return !(meta && !meta.canCrit && meta.explosionStyle === 'none');
			});
			if (missDie) {
				const firstActive = missDie.results.find((r) => r.active && !r.discarded);
				this.isMiss = firstActive?.result === 1;
			} else {
				// All dice are neutral — no die qualifies for miss detection
				this.isMiss = false;
			}
		}

		// ── primaryDie assignment: leftmost c/cv tagged, or leftmost Die ──
		const taggedPrimary = dieTerms.find((term) => {
			const meta = getNimbleMods(term);
			return meta?.canCrit === true;
		});
		this.primaryDie = taggedPrimary ?? dieTerms[0];

		this._applyBrutalRemapping(dieTerms);

		// ── Recalculate total if any vicious die critted ──
		if (this.critCount > 0) {
			const hasVicious = dieTerms.some((term) => {
				const meta = getNimbleMods(term);
				return meta?.canCrit && meta.explosionStyle === 'vicious';
			});
			if (hasVicious) {
				this._recalculateTotal();
			}
		}

		// ── primaryDieAsDamage: false → exclude leftmost die's base value ──
		if (!this.options.primaryDieAsDamage) {
			const leftmostDie = dieTerms[0];
			if (leftmostDie) {
				const baseResult = leftmostDie.results.find((r) => r.active && !r.discarded);
				if (baseResult) {
					this.excludedPrimaryDieValue = baseResult.result;
					const internals = this as object as { _total: number };
					internals._total = (this._total ?? 0) - this.excludedPrimaryDieValue;
				}
			}
		}
	}

	/**
	 * Recalculates the roll total from all terms. Works in both legacy and
	 * modifier-mode by summing active results from all Die/PrimaryDie terms
	 * and totals from other terms.
	 */
	private _recalculateTotal(): void {
		let total = 0;
		for (const term of this.terms) {
			if (term instanceof Terms.Die) {
				total += term.results
					.filter((r) => r.active && !r.discarded)
					.reduce((sum, r) => sum + r.result, 0);
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
			critCount: this.critCount,
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
			if (roll.modifierMode) {
				// Modifier-mode: primary is leftmost Die with c/cv modifier
				const taggedPrimary = roll.terms.find(
					(t) =>
						t instanceof Terms.Die &&
						Array.isArray(t.modifiers) &&
						(t.modifiers.includes('c') || t.modifiers.includes('cv')),
				);
				roll.primaryDie =
					(taggedPrimary as foundry.dice.terms.Die | undefined) ??
					(roll.terms.find((t) => t instanceof Terms.Die) as foundry.dice.terms.Die | undefined);
			} else {
				// Legacy: restore PrimaryDie if it exists in terms
				const primaryTerm = roll.terms.find((t) => t instanceof PrimaryDie);
				if (primaryTerm) {
					roll.primaryDie = primaryTerm;
				}
			}

			roll._applyBrutalRemapping(
				roll.terms.filter((t): t is foundry.dice.terms.Die => t instanceof Terms.Die),
			);
		}

		// Restore critCount and excludedPrimaryDieValue if serialized
		roll.critCount = data.critCount ?? 0;
		roll.excludedPrimaryDieValue = data.excludedPrimaryDieValue ?? 0;

		return roll as FixedInstanceType<T>;
	}
}

export { DamageRoll };
