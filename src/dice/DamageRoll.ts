import type { AnyObject, FixedInstanceType } from 'fvtt-types/utils';
import type { InexactPartial } from '#types/utils.js';

import { PrimaryDie } from './terms/PrimaryDie.js';

const Terms = foundry.dice.terms;

declare namespace DamageRoll {
	interface Data extends Record<string, number | string | boolean | object | null> {}

	interface Options extends foundry.dice.Roll.Options {
		canCrit: boolean;
		canMiss: boolean;
		criticalThreshold?: number;
		damageType?: string;
		fumbleThreshold?: number;
		rollMode: number;
		primaryDieValue: number;
		primaryDieModifier: number;
	}

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
	}

	type Evaluated<T extends DamageRoll> = T & {
		_evaluated: true;
		_total: number;
		get total(): number;
	};
}

class DamageRoll extends foundry.dice.Roll<DamageRoll.Data> {
	declare options: DamageRoll.Options;

	isCritical: undefined | boolean = undefined;

	isMiss: undefined | boolean = undefined;

	originalFormula: string;

	primaryDie: PrimaryDie | undefined = undefined;

	override _formula: string = '';

	constructor(formula: string, data: DamageRoll.Data = {}, options?: DamageRoll.Options) {
		super(formula, data, options);

		// Setup Defaults
		this.options.canCrit ??= true;
		this.options.canMiss ??= true;
		this.options.rollMode ??= 0;
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
	_preProcessFormula(_formula: string, _data: DamageRoll.Data, options: DamageRoll.Options) {
		// Separate out the primary die
		if (options.canCrit || options.canMiss) {
			const { rollMode = 0 } = options;
			const shouldExplode = options.canCrit;
			const firstDieTerm = this.terms.find((t) => t instanceof Terms.Die);

			if (firstDieTerm) {
				const { number = 1, faces } = firstDieTerm;

				let primaryTerm: PrimaryDie;

				if (number > 1) {
					// Reduce number of original term by one
					firstDieTerm.number = (number ?? 1) - 1;

					// Add Operator Term before Primary Term
					const operatorTerm = new Terms.OperatorTerm({ operator: '+' });
					this.terms.unshift(operatorTerm);

					// Create Primary Term
					primaryTerm = new PrimaryDie({
						number: 1 + Math.abs(rollMode),
						faces: faces ?? 6,
						modifiers: [],
						options: { flavor: 'Primary Die' },
					});

					if (rollMode > 0) primaryTerm.modifiers.push('kh');
					else if (rollMode < 0) primaryTerm.modifiers.push('kl');

					// Add Explosion after adv/div has been calculated
					if (shouldExplode) primaryTerm.modifiers.push('x');

					if (options.primaryDieValue) {
						primaryTerm.results = [{ result: options.primaryDieValue, active: true }];
					}

					if (options.primaryDieModifier && faces) {
						const baseResult = Math.ceil(Math.random() * faces);
						const modifiedResult = baseResult + options.primaryDieModifier;
						if (modifiedResult > faces) {
							primaryTerm.results = [{ result: faces, active: true }];
							// Add excess as a separate numeric term
							const excess = modifiedResult - faces;
							const excessTerm = new Terms.NumericTerm({ number: excess });
							const operatorTermExcess = new Terms.OperatorTerm({ operator: '+' });
							this.terms.splice(
								this.terms.indexOf(primaryTerm) + 1,
								0,
								operatorTermExcess,
								excessTerm,
							);
						} else {
							primaryTerm.results = [{ result: modifiedResult, active: true }];
						}
					}

					this.terms.unshift(primaryTerm);
				} else {
					primaryTerm = new PrimaryDie({
						number: 1,
						faces: firstDieTerm.faces ?? 6,
						modifiers: [],
					});

					// Add rollMode
					primaryTerm.number = (number ?? 1) + Math.abs(rollMode);

					if (rollMode > 0) primaryTerm.modifiers.push('kh');
					else if (rollMode < 0) primaryTerm.modifiers.push('kl');

					// Add Explosion for critical after adv/dis
					if (shouldExplode) primaryTerm.modifiers.push('x');

					if (options.primaryDieValue) {
						primaryTerm.results = [{ result: options.primaryDieValue, active: true }];
					}

					if (options.primaryDieModifier && faces) {
						const baseResult = Math.ceil(Math.random() * faces);
						const modifiedResult = baseResult + options.primaryDieModifier;
						if (modifiedResult > faces) {
							primaryTerm.results = [{ result: faces, active: true }];
							// Add excess as a separate numeric term
							const excess = modifiedResult - faces;
							const excessTerm = new Terms.NumericTerm({ number: excess });
							const operatorTermExcess = new Terms.OperatorTerm({ operator: '+' });
							this.terms.splice(
								this.terms.indexOf(primaryTerm) + 1,
								0,
								operatorTermExcess,
								excessTerm,
							);
						} else {
							primaryTerm.results = [{ result: modifiedResult, active: true }];
						}
					}

					// Update term
					const idx = this.terms.findIndex((t) => t instanceof Terms.Die);
					if (idx !== -1) this.terms[idx] = primaryTerm;
				}

				this.primaryDie = primaryTerm;

				// Alter formula
				this.resetFormula();
			}
		}
	}

	/** ------------------------------------------------------ */
	/**                       Helpers                          */
	/** ------------------------------------------------------ */
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
	override async _evaluate(
		options?: InexactPartial<foundry.dice.Roll.Options>,
	): Promise<DamageRoll.Evaluated<this>> {
		await super._evaluate(options);

		const primaryTerm = this.terms.find((t) => t instanceof PrimaryDie);

		if (primaryTerm) {
			if (this.options.canCrit) this.isCritical = primaryTerm.exploded;
			if (this.options.canMiss) this.isMiss = primaryTerm.isMiss;
		}

		return this as DamageRoll.Evaluated<this>;
	}

	override toJSON() {
		return {
			...super.toJSON(),
			data: this.data,
			originalFormula: this.originalFormula,
			isMiss: this.isMiss,
			isCritical: this.isCritical,
		};
	}

	/** ------------------------------------------------------ */
	/**                    Static Methods                      */
	/** ------------------------------------------------------ */
	private static _isRollTermArray(
		terms: DamageRoll.SerializedData['terms'],
	): terms is foundry.dice.terms.RollTerm[] {
		return Array.isArray(terms) && terms.every((t) => t instanceof foundry.dice.terms.RollTerm);
	}

	private static _setEvaluatedState(roll: DamageRoll, total: number): void {
		const internals = roll as object as { _evaluated: boolean; _total: number };
		internals._evaluated = true;
		internals._total = total;
	}

	private static _baseRollFromSerializedData(data: DamageRoll.SerializedData): Roll<AnyObject> {
		// Temporarily remove the class property to avoid infinite recursion
		// when calling the parent's fromData method
		const dataWithoutClass = { ...data };
		delete dataWithoutClass.class;

		// Foundry's Roll.fromData is typed as `Roll.Data`, but at runtime it accepts the broader
		// serialized shapes we store (including reconstructed term instances).
		return foundry.dice.Roll.fromData(dataWithoutClass as object as foundry.dice.Roll.Data);
	}

	static fromRoll(roll) {
		const newRoll = new DamageRoll(roll.formula, roll.data, roll.options);
		Object.assign(newRoll, roll);
		return newRoll;
	}

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

		return roll as FixedInstanceType<T>;
	}
}

export { DamageRoll };
